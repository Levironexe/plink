import { getCurrentUser } from "@/lib/auth";
import { emailEnabled } from "@plink/email/email";
import { fail, ok, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@plink/email/tokens";

/** Re-sends the confirmation link to the signed-in creator's own address. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in", 401);

  // Keyed by account rather than IP — the cost is ours to bear per mailbox.
  const limit = rateLimit(`resend-verification:${user.id}`, 3, 60 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  if (user.emailVerified) return ok({ ok: true, alreadyVerified: true, sent: false });

  if (!emailEnabled()) {
    return fail("Email is not configured — add RESEND_API_KEY to .env.local", 503);
  }

  const { delivered } = await sendVerificationEmail(user);
  if (!delivered) return fail("Could not send the email. Try again in a moment.", 502);

  return ok({ ok: true, alreadyVerified: false, sent: true });
}
