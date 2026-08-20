import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { ok } from "@/lib/http";
import { absoluteUrl, escapeHtml, verifyUnsubscribeSignature } from "@plink/email/email";

/**
 * One-click unsubscribe. Public by design — the recipient is not a Plink user
 * and will never be signed in — so the subscriber id carries an HMAC that only
 * this server can mint. See `unsubscribeUrl()` in `@/lib/email`.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'Geist','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function page({ title, body, status }: { title: string; body: string; status: number }) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)} — Plink</title>
  </head>
  <body style="margin:0;background:#fafafa;font-family:${FONT};color:#171717;">
    <main style="max-width:440px;margin:0 auto;padding:96px 20px;">
      <p style="margin:0 0 24px;font-size:16px;font-weight:600;letter-spacing:-0.02em;">Plink</p>
      <div style="background:#ffffff;border:1px solid #ebebeb;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 10px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.04em;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4d4d4d;">${escapeHtml(body)}</p>
        <a href="${absoluteUrl("/")}" style="display:inline-block;background:#171717;color:#ffffff;font-size:15px;font-weight:500;line-height:20px;text-decoration:none;padding:12px 22px;border-radius:6px;">Go to Plink</a>
      </div>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("s") ?? "";
  const signature = req.nextUrl.searchParams.get("t") ?? "";
  const wantsJson =
    req.nextUrl.searchParams.get("format") === "json" ||
    (req.headers.get("accept") ?? "").includes("application/json");

  if (!id || !verifyUnsubscribeSignature(id, signature)) {
    return wantsJson
      ? ok({ ok: false, error: "That unsubscribe link is invalid" }, { status: 400 })
      : page({
          status: 400,
          title: "That link isn’t valid",
          body: "The unsubscribe link is incomplete or has been altered. Reply to the email and the creator can remove you by hand.",
        });
  }

  // Idempotent: an id that is already unsubscribed, or gone entirely, still
  // reports success — the recipient's intent is satisfied either way.
  await prisma.subscriber.updateMany({
    where: { id, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });

  if (wantsJson) return ok({ ok: true, unsubscribed: true });

  return page({
    status: 200,
    title: "You’re unsubscribed",
    body: "You won’t get any more emails from this creator. Nothing else about your account changes.",
  });
}
