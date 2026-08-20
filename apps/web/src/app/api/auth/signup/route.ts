import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { createSession, hashPassword } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { signupSchema } from "@plink/core/validation";
import { isReservedUsername, slugifyUsername } from "@plink/core/utils";
import { DEMO_BY_USERNAME } from "@plink/core/demo-profiles";
import { DEFAULT_THEME } from "@plink/core/themes";
import { BLOCK_LIBRARY } from "@plink/core/blocks";
import { sendVerificationEmail } from "@plink/email/tokens";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "signup"), 8, 60 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return fail("Invalid request body");

  const parsed = signupSchema.safeParse({
    ...body,
    username: slugifyUsername(String(body.username ?? "")),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check your details", 422, {
      field: parsed.error.issues[0]?.path[0],
    });
  }

  const { email, password, username, displayName } = parsed.data;

  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } }),
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (emailTaken) return fail("An account with that email already exists", 409, { field: "email" });
  if (usernameTaken) return fail("That username is taken", 409, { field: "username" });

  if (isReservedUsername(username) || DEMO_BY_USERNAME.has(username)) {
    return fail("That username is reserved", 409, { field: "username" });
  }

  const linkDefaults = BLOCK_LIBRARY.find((b) => b.type === "link")!.defaults;

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      username,
      displayName: displayName?.trim() || username,
      theme: { create: { ...DEFAULT_THEME } },
      blocks: {
        create: [
          {
            type: "link",
            title: linkDefaults.title ?? "My first link",
            url: "https://example.com",
            position: 0,
          },
          { type: "socials", title: "", position: 1 },
        ],
      },
      mediaKit: { create: {} },
    },
    select: { id: true, username: true, email: true, displayName: true },
  });

  await createSession(user.id);

  // Never blocks signup — an unconfigured or failing mailer just leaves the
  // account unverified, and the dashboard offers a resend.
  const { delivered } = await sendVerificationEmail(user);

  return ok({ ok: true, username: user.username, verificationSent: delivered }, { status: 201 });
}
