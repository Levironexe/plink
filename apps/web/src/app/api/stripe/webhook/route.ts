import type { NextRequest } from "next/server";
import type { Stripe } from "@plink/payments";
import { nanoid } from "nanoid";
import { prisma } from "@plink/db";
import { fail, ok } from "@/lib/http";
import { getStripe, planForPriceId, stripeEnabled, webhookSecret } from "@plink/payments";

/**
 * Stripe retries every non-2xx delivery, and can send the same event twice even
 * on success. This is the cheap first line of defence; the real guarantee comes
 * from the status-guarded `updateMany` calls below, which are safe to re-run.
 */
const handled = new Set<string>();
const HANDLED_CAP = 1000;

function claim(eventId: string) {
  if (handled.has(eventId)) return false;
  if (handled.size >= HANDLED_CAP) {
    for (const old of handled) {
      handled.delete(old);
      if (handled.size <= HANDLED_CAP * 0.8) break;
    }
  }
  handled.add(eventId);
  return true;
}

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function POST(req: NextRequest) {
  const secret = webhookSecret();
  if (!stripeEnabled() || !secret) return fail("Stripe webhooks are not configured", 503);

  const signature = req.headers.get("stripe-signature");
  if (!signature) return fail("Missing stripe-signature header", 400);

  // The signature covers the exact bytes Stripe sent — parsing first would break it.
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return fail("Invalid signature", 400);
  }

  if (!claim(event.id)) return ok({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await onCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionChanged(event.data.object);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }
  } catch (error) {
    // Release the claim so Stripe's retry is treated as a fresh delivery.
    handled.delete(event.id);
    console.error(`[stripe] ${event.type} failed:`, error instanceof Error ? error.message : "unknown error");
    return fail("Webhook handler failed", 500);
  }

  return ok({ received: true });
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "subscription") {
    await linkSubscriptionSession(session);
    return;
  }

  // Delayed methods (bank debits) complete the session before the money lands.
  if (session.payment_status !== "paid") return;

  if (session.metadata?.kind === "invoice") {
    await markInvoicePaid(session);
    return;
  }
  await markOrderPaid(session);
}

async function markOrderPaid(session: Stripe.Checkout.Session) {
  const email = session.customer_details?.email ?? session.customer_email ?? "anonymous@plink.local";

  let order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true, status: true, productId: true },
  });

  // The checkout route writes this row; rebuild it from metadata if that failed.
  if (!order) {
    const creatorId = session.metadata?.creatorId;
    if (!creatorId) return;
    order = await prisma.order.create({
      data: {
        userId: creatorId,
        productId: session.metadata?.productId ?? null,
        email,
        amountCents: session.amount_total ?? 0,
        status: "pending",
        stripeSessionId: session.id,
      },
      select: { id: true, status: true, productId: true },
    });
  }

  const product = order.productId
    ? await prisma.product.findUnique({
        where: { id: order.productId },
        select: { id: true, fileUrl: true },
      })
    : null;

  // Filtering on `pending` is the idempotency guard: a replay updates 0 rows.
  const updated = await prisma.order.updateMany({
    where: { stripeSessionId: session.id, status: "pending" },
    data: {
      status: "paid",
      email,
      amountCents: session.amount_total ?? undefined,
      stripePaymentIntentId: idOf(session.payment_intent),
      ...(product?.fileUrl ? { downloadToken: nanoid(32) } : {}),
    },
  });

  if (updated.count > 0 && product) {
    await prisma.product.update({ where: { id: product.id }, data: { sales: { increment: 1 } } });
  }
}

async function markInvoicePaid(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  const where = invoiceId ? { id: invoiceId } : { stripeSessionId: session.id };

  await prisma.invoice.updateMany({
    where: { ...where, status: { not: "paid" } },
    data: { status: "paid", paidAt: new Date(), stripeSessionId: session.id },
  });
}

/** Records the ids from a subscription checkout; the plan itself is set by the subscription events. */
async function linkSubscriptionSession(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) return;

  const customerId = idOf(session.customer);
  const subscriptionId = idOf(session.subscription);

  await prisma.user.updateMany({
    where: { id: userId },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    },
  });
}

async function userForSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (userId) {
    const byId = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, plan: true } });
    if (byId) return byId;
  }

  const customerId = idOf(subscription.customer);
  if (customerId) {
    return prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true, plan: true } });
  }
  return null;
}

/** Collapses Stripe's subscription states onto the four the schema records. */
function planStatusFor(status: Stripe.Subscription.Status) {
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "active";
}

async function onSubscriptionChanged(subscription: Stripe.Subscription) {
  const user = await userForSubscription(subscription);
  if (!user) return;

  const item = subscription.items.data[0];
  const mapped = planForPriceId(item?.price?.id);
  const metaPlan = subscription.metadata?.plan;

  const plan = mapped?.plan ?? (metaPlan === "vip" ? "vip" : "pro");
  const interval =
    mapped?.interval ?? (item?.price?.recurring?.interval === "year" ? "year" : "month");

  const planStatus = planStatusFor(subscription.status);
  // A past-due creator keeps their features while Stripe retries the card.
  const entitled = planStatus !== "canceled";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: entitled ? plan : "free",
      planStatus,
      planInterval: entitled ? interval : null,
      planRenewsAt: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      stripeSubscriptionId: subscription.id,
    },
  });
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const user = await userForSubscription(subscription);
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "free",
      planStatus: "canceled",
      planInterval: null,
      planRenewsAt: null,
      stripeSubscriptionId: null,
    },
  });
}
