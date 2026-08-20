import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import {
  absoluteUrl,
  broadcastTemplate,
  emailEnabled,
  sendBatch,
  unsubscribeUrl,
  type BatchMessage,
} from "@plink/email/email";

/** Sends a draft broadcast to every subscriber who has not unsubscribed. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return fail("Not signed in", 401);

  const limit = rateLimit(`broadcast-send:${user.id}`, 10, 60 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const broadcast = await prisma.broadcast.findFirst({ where: { id, userId: user.id } });
  if (!broadcast) return fail("Broadcast not found", 404);

  // A campaign goes out once. Anything already in flight or delivered is a conflict.
  if (broadcast.status === "sent" || broadcast.status === "sending") {
    return fail(
      broadcast.status === "sent" ? "That broadcast has already been sent" : "That broadcast is already sending",
      409,
    );
  }

  if (!emailEnabled()) {
    return fail("Email is not configured — add RESEND_API_KEY to .env.local", 503);
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { userId: user.id, unsubscribedAt: null },
    select: { id: true, email: true },
  });
  if (subscribers.length === 0) return fail("You don’t have any subscribers to send to yet", 400);

  // Claim the row before doing any network work so a second request 409s.
  const claimed = await prisma.broadcast.updateMany({
    where: { id: broadcast.id, userId: user.id, status: { in: ["draft", "failed"] } },
    data: { status: "sending" },
  });
  if (claimed.count === 0) return fail("That broadcast is already sending", 409);

  const pageUrl = absoluteUrl(`/${user.username}`);
  const messages: BatchMessage[] = subscribers.map((s) => ({
    to: s.email,
    ...broadcastTemplate({
      subject: broadcast.subject,
      body: broadcast.body,
      fromName: user.displayName,
      unsubscribeUrl: unsubscribeUrl(s.id),
      pageUrl,
    }),
  }));

  const result = await sendBatch(messages);

  if (!result.ok && result.sent === 0) {
    await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: "failed" } });
    return fail("Resend could not accept that broadcast. Try again in a moment.", 502);
  }

  const sent = await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { status: "sent", recipients: result.sent, sentAt: new Date() },
  });

  return ok({ broadcast: sent, delivered: result.sent, failed: result.failed });
}
