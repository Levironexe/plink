/**
 * Email layer — Resend transport plus the on-brand HTML templates.
 *
 * Two rules shape this file:
 *
 * 1. `RESEND_API_KEY` may be empty. The Resend constructor throws on a missing
 *    key, so the client is built lazily on first real send — never at module
 *    import time — and every entry point degrades to a warning instead of an
 *    exception. An unconfigured install still builds, boots and navigates.
 * 2. No database imports. Keeping this module DB-free means templates and the
 *    transport can be unit tested without a Prisma client or a network call.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";

/* ------------------------------------------------------------------ config */

/** Thrown when a caller reaches for the Resend client without a configured key. */
export class EmailNotConfiguredError extends Error {
  readonly code = "email_not_configured" as const;

  constructor(message = "Email is not configured — add RESEND_API_KEY to .env.local") {
    super(message);
    this.name = "EmailNotConfiguredError";
  }
}

function apiKey() {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

/** True when a Resend API key is present. Safe to call anywhere, including at render time. */
export function emailEnabled() {
  return apiKey().length > 0;
}

/** The verified sender. Resend's shared onboarding sender is the local fallback. */
export function emailFrom() {
  return process.env.RESEND_FROM_EMAIL?.trim() || "Plink <onboarding@resend.dev>";
}

export function emailReplyTo() {
  return process.env.RESEND_REPLY_TO?.trim() || undefined;
}

/** Absolute URL for links that live inside an email — relative hrefs do not work there. */
export function absoluteUrl(path = "/") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

let client: Resend | null = null;
let clientKey = "";

/**
 * The lazily-constructed Resend client.
 *
 * @throws {EmailNotConfiguredError} when `RESEND_API_KEY` is unset — prefer
 * {@link sendEmail}, which turns that case into a no-op instead.
 */
export function getResend(): Resend {
  const key = apiKey();
  if (!key) throw new EmailNotConfiguredError();
  if (!client || clientKey !== key) {
    client = new Resend(key);
    clientKey = key;
  }
  return client;
}

/* --------------------------------------------------------------- transport */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Overrides `RESEND_FROM_EMAIL` for this message only. */
  from?: string;
};

export type SendEmailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured" }
  | { sent: false; reason: "failed"; error: string };

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Unknown email error";
}

/**
 * Sends one message. Never throws: an unconfigured install logs a warning and
 * reports `{ sent: false, reason: "not_configured" }` so callers (signup,
 * password reset) keep working without email.
 */
export async function sendEmail({ to, subject, html, replyTo, from }: SendEmailInput): Promise<SendEmailResult> {
  if (!emailEnabled()) {
    // Subject only — recipients and keys never reach the log.
    console.warn(`[email] skipped “${subject}” — RESEND_API_KEY is not set`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: from ?? emailFrom(),
      to,
      subject,
      html,
      replyTo: replyTo ?? emailReplyTo(),
    });
    if (error) {
      console.error(`[email] “${subject}” rejected by Resend: ${error.message}`);
      return { sent: false, reason: "failed", error: error.message };
    }
    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    console.error(`[email] “${subject}” failed: ${errorMessage(err)}`);
    return { sent: false, reason: "failed", error: errorMessage(err) };
  }
}

export type BatchMessage = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export type SendBatchResult =
  | { sent: number; failed: number; ok: true }
  | { sent: number; failed: number; ok: false; reason: "not_configured" | "failed"; error?: string };

/** Resend accepts at most 100 messages per batch call. */
const BATCH_SIZE = 100;

/**
 * Fans a broadcast out over Resend's batch endpoint, chunked to the API limit.
 * Partial failure is reported rather than thrown so the caller can still record
 * how many recipients were reached.
 */
export async function sendBatch(messages: BatchMessage[]): Promise<SendBatchResult> {
  if (messages.length === 0) return { ok: true, sent: 0, failed: 0 };

  if (!emailEnabled()) {
    console.warn(`[email] skipped a batch of ${messages.length} — RESEND_API_KEY is not set`);
    return { ok: false, sent: 0, failed: messages.length, reason: "not_configured" };
  }

  const from = emailFrom();
  const fallbackReplyTo = emailReplyTo();
  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await getResend().batch.send(
        chunk.map((m) => ({
          from,
          to: m.to,
          subject: m.subject,
          html: m.html,
          replyTo: m.replyTo ?? fallbackReplyTo,
        })),
      );
      if (error) {
        failed += chunk.length;
        firstError ??= error.message;
        console.error(`[email] batch chunk rejected by Resend: ${error.message}`);
        continue;
      }
      sent += data?.data?.length ?? chunk.length;
    } catch (err) {
      failed += chunk.length;
      firstError ??= errorMessage(err);
      console.error(`[email] batch chunk failed: ${errorMessage(err)}`);
    }
  }

  if (failed > 0) return { ok: false, sent, failed, reason: "failed", error: firstError };
  return { ok: true, sent, failed };
}

/* --------------------------------------------------- unsubscribe signatures */

function signingSecret() {
  return process.env.AUTH_SECRET || "plink-insecure-development-secret-value";
}

/**
 * A short HMAC over the subscriber id. The unsubscribe route is public, so the
 * signature is what stops anyone from unsubscribing a list by guessing ids.
 */
export function unsubscribeSignature(subscriberId: string) {
  return createHmac("sha256", signingSecret()).update(`unsubscribe:${subscriberId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeSignature(subscriberId: string, signature: string) {
  const expected = Buffer.from(unsubscribeSignature(subscriberId));
  const given = Buffer.from(signature ?? "");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/** The absolute one-click unsubscribe link embedded in every broadcast. */
export function unsubscribeUrl(subscriberId: string) {
  const params = new URLSearchParams({ s: subscriberId, t: unsubscribeSignature(subscriberId) });
  return absoluteUrl(`/api/unsubscribe?${params.toString()}`);
}

/* --------------------------------------------------------------- templates */

export type EmailTemplate = { subject: string; html: string };

/** Creator-supplied copy lands inside an HTML document — escape it first. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain-text body → escaped paragraphs. Blank lines split, single breaks stay. */
function paragraphs(body: string) {
  return body
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#4d4d4d;">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

// Email clients strip <style> blocks, so every rule below is inline. The palette
// mirrors DESIGN.md: ink #171717 on a white card, #ebebeb hairlines, #fafafa page.
const FONT = "-apple-system,BlinkMacSystemFont,'Geist','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#171717;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:500;line-height:20px;text-decoration:none;padding:12px 22px;border-radius:6px;">${escapeHtml(label)}</a>`;
}

function layout({
  title,
  preheader,
  content,
  footer,
}: {
  title: string;
  preheader: string;
  content: string;
  footer: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fafafa;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 0 20px;font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.02em;color:#171717;">
                Plink
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #ebebeb;border-radius:12px;padding:32px;font-family:${FONT};">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:18px;color:#888888;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function heading(text: string) {
  return `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.04em;color:#171717;">${escapeHtml(text)}</h1>`;
}

function paragraph(text: string) {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#4d4d4d;">${escapeHtml(text)}</p>`;
}

function fallbackLink(url: string) {
  return `<p style="margin:24px 0 0;padding:16px 0 0;border-top:1px solid #ebebeb;font-size:12px;line-height:20px;color:#888888;">If the button does not work, paste this into your browser:<br /><span style="color:#0070f3;word-break:break-all;">${escapeHtml(url)}</span></p>`;
}

/**
 * "Confirm your email" — sent at signup and from the resend-verification route.
 * The link is single-use and expires in 24 hours.
 */
export function verifyEmailTemplate({ verifyUrl, name }: { verifyUrl: string; name?: string | null }): EmailTemplate {
  const greeting = name?.trim() ? `Hi ${name.trim()}, one` : "One";
  return {
    subject: "Confirm your email — Plink",
    html: layout({
      title: "Confirm your email",
      preheader: "Confirm your email address to finish setting up your Plink.",
      content: [
        heading("Confirm your email"),
        paragraph(`${greeting} quick step and your Plink is fully set up. This link expires in 24 hours.`),
        button(verifyUrl, "Confirm email address"),
        fallbackLink(verifyUrl),
      ].join(""),
      footer: "You received this because someone signed up for Plink with this address. If that wasn’t you, ignore this email.",
    }),
  };
}

/**
 * "Reset your password" — sent from the forgot-password route. The link is
 * single-use and expires in 1 hour.
 */
export function resetPasswordTemplate({ resetUrl, name }: { resetUrl: string; name?: string | null }): EmailTemplate {
  const greeting = name?.trim() ? `Hi ${name.trim()}, we` : "We";
  return {
    subject: "Reset your Plink password",
    html: layout({
      title: "Reset your password",
      preheader: "Use this link to choose a new Plink password. It expires in one hour.",
      content: [
        heading("Reset your password"),
        paragraph(`${greeting} got a request to reset the password on this account. This link expires in 1 hour and can only be used once.`),
        button(resetUrl, "Choose a new password"),
        fallbackLink(resetUrl),
      ].join(""),
      footer: "If you didn’t ask for a reset you can safely ignore this email — your password stays the same.",
    }),
  };
}

/**
 * A creator broadcast to their own subscriber list. Always carries a working
 * unsubscribe link: it is both a legal requirement and what keeps the sending
 * domain out of spam folders.
 */
export function broadcastTemplate({
  subject,
  body,
  fromName,
  unsubscribeUrl: unsubUrl,
  pageUrl,
}: {
  subject: string;
  body: string;
  fromName: string;
  unsubscribeUrl: string;
  pageUrl?: string;
}): EmailTemplate {
  const footerParts = [
    `You’re getting this because you subscribed to ${escapeHtml(fromName)} on Plink.`,
    `<a href="${escapeHtml(unsubUrl)}" style="color:#888888;text-decoration:underline;">Unsubscribe</a>`,
  ];
  if (pageUrl) {
    footerParts.splice(
      1,
      0,
      `<a href="${escapeHtml(pageUrl)}" style="color:#888888;text-decoration:underline;">View their page</a>`,
    );
  }

  return {
    subject,
    html: layout({
      title: subject,
      preheader: body.trim().slice(0, 140),
      content: [
        `<p style="margin:0 0 6px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;line-height:16px;color:#888888;">${escapeHtml(fromName)}</p>`,
        heading(subject),
        paragraphs(body),
      ].join(""),
      footer: footerParts.join(" · "),
    }),
  };
}
