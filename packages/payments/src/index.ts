import Stripe from "stripe";

export type PaidPlan = "pro" | "vip";
export type BillingInterval = "month" | "year";

/** Free plans fund the platform with a cut of each sale; see PLANS in pricing.ts. */
const DEFAULT_FEE_BPS = 500;
const DEFAULT_SITE_URL = "http://localhost:3000";

const PRICE_ENV: Record<PaidPlan, Record<BillingInterval, string>> = {
  pro: { month: "STRIPE_PRICE_PRO_MONTHLY", year: "STRIPE_PRICE_PRO_YEARLY" },
  vip: { month: "STRIPE_PRICE_VIP_MONTHLY", year: "STRIPE_PRICE_VIP_YEARLY" },
};

/** Raised when a payment path is reached without `STRIPE_SECRET_KEY` set. */
export class StripeNotConfiguredError extends Error {
  readonly code = "STRIPE_NOT_CONFIGURED";

  constructor(message = "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.") {
    super(message);
    this.name = "StripeNotConfiguredError";
  }
}

/** Treats blank-but-present env vars — the default in a fresh checkout — as unset. */
function env(name: string) {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function stripeEnabled() {
  return env("STRIPE_SECRET_KEY") !== null;
}

export function webhookSecret() {
  return env("STRIPE_WEBHOOK_SECRET");
}

let cached: { key: string; client: Stripe } | null = null;

/**
 * Builds the client on first use, never at module load: an empty secret key must
 * not crash `next build` or take the whole app down with it.
 */
export function getStripe(): Stripe {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new StripeNotConfiguredError();

  if (!cached || cached.key !== key) {
    cached = { key, client: new Stripe(key, { appInfo: { name: "Plink" } }) };
  }
  return cached.client;
}

/** Platform cut in basis points. Bad or missing input falls back to 5%. */
export function platformFeeBps() {
  const raw = env("STRIPE_PLATFORM_FEE_BPS");
  if (raw === null) return DEFAULT_FEE_BPS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_FEE_BPS;
  return Math.min(10_000, Math.round(parsed));
}

export function priceIdFor(plan: PaidPlan, interval: BillingInterval) {
  return env(PRICE_ENV[plan][interval]);
}

/** Reverse of `priceIdFor` — lets the webhook map a Stripe price back onto a plan. */
export function planForPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;

  for (const plan of Object.keys(PRICE_ENV) as PaidPlan[]) {
    for (const interval of Object.keys(PRICE_ENV[plan]) as BillingInterval[]) {
      if (priceIdFor(plan, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}

export function siteUrl() {
  return (env("NEXT_PUBLIC_SITE_URL") ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}/${path.replace(/^\/+/, "")}`;
}

/**
 * The fee the platform keeps from a creator sale. Pro and Studio pay 0% — the
 * promise made on the pricing page — so only free accounts are charged.
 */
export function applicationFeeCents(amountCents: number, plan: string, bps = platformFeeBps()) {
  if (plan === "pro" || plan === "vip") return 0;
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;

  const fee = Math.round((amountCents * bps) / 10_000);
  return Math.max(0, Math.min(fee, amountCents));
}

export type ConnectTarget = {
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  plan: string;
};

/**
 * Destination-charge parameters for a creator sale, or null when the creator
 * cannot be paid out yet — in which case the platform collects and settles later.
 */
export function destinationCharge(amountCents: number, creator: ConnectTarget) {
  if (!creator.stripeAccountId || !creator.payoutsEnabled) return null;
  return {
    destination: creator.stripeAccountId,
    applicationFeeAmount: applicationFeeCents(amountCents, creator.plan),
  };
}

/** Shared checkout options so a session created here settles onto the right account. */
export function paymentIntentDataFor(amountCents: number, creator: ConnectTarget) {
  const charge = destinationCharge(amountCents, creator);
  if (!charge) return undefined;

  const data: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    transfer_data: { destination: charge.destination },
  };
  // Stripe rejects a zero application fee, so paid plans simply omit it.
  if (charge.applicationFeeAmount > 0) data.application_fee_amount = charge.applicationFeeAmount;
  return data;
}

/** Re-exported so route handlers can type Stripe payloads without depending on the SDK. */
export type { default as Stripe } from "stripe";
