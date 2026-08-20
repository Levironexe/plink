import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmailNotConfiguredError,
  absoluteUrl,
  broadcastTemplate,
  emailEnabled,
  emailFrom,
  escapeHtml,
  getResend,
  resetPasswordTemplate,
  sendBatch,
  sendEmail,
  unsubscribeSignature,
  unsubscribeUrl,
  verifyEmailTemplate,
  verifyUnsubscribeSignature,
} from "@plink/email/email";

/** Every test runs against an unconfigured install unless it says otherwise. */
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("RESEND_FROM_EMAIL", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plink.test");
  vi.stubEnv("AUTH_SECRET", "test-secret");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("emailEnabled", () => {
  it("is false for a missing or blank key", () => {
    expect(emailEnabled()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "   ");
    expect(emailEnabled()).toBe(false);
  });

  it("is true once a key is present", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(emailEnabled()).toBe(true);
  });
});

describe("getResend", () => {
  it("throws a typed error rather than constructing without a key", () => {
    expect(() => getResend()).toThrow(EmailNotConfiguredError);
    try {
      getResend();
    } catch (err) {
      expect((err as EmailNotConfiguredError).code).toBe("email_not_configured");
      expect((err as Error).message).toContain("RESEND_API_KEY");
    }
  });

  it("builds a client once a key exists", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(getResend()).toBe(getResend());
  });
});

describe("emailFrom", () => {
  it("falls back to the shared onboarding sender", () => {
    expect(emailFrom()).toContain("@");
    vi.stubEnv("RESEND_FROM_EMAIL", "Maya <maya@plink.test>");
    expect(emailFrom()).toBe("Maya <maya@plink.test>");
  });
});

describe("sendEmail", () => {
  it("no-ops instead of throwing when email is unconfigured", async () => {
    const result = await sendEmail({ to: "reader@example.com", subject: "Hello", html: "<p>Hi</p>" });
    expect(result).toEqual({ sent: false, reason: "not_configured" });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("warns with the subject only — never a recipient or a key", async () => {
    await sendEmail({ to: "reader@example.com", subject: "Hello", html: "<p>Hi</p>" });
    const warned = vi.mocked(console.warn).mock.calls[0]?.join(" ") ?? "";
    expect(warned).toContain("Hello");
    expect(warned).not.toContain("reader@example.com");
  });
});

describe("sendBatch", () => {
  it("returns early for an empty list without touching the network", async () => {
    await expect(sendBatch([])).resolves.toEqual({ ok: true, sent: 0, failed: 0 });
  });

  it("reports every message as failed when unconfigured", async () => {
    const result = await sendBatch([{ to: "a@example.com", subject: "S", html: "<p>x</p>" }]);
    expect(result).toMatchObject({ ok: false, sent: 0, failed: 1, reason: "not_configured" });
  });
});

describe("absoluteUrl", () => {
  it("joins a path onto the configured site origin", () => {
    expect(absoluteUrl("/login")).toBe("https://plink.test/login");
    expect(absoluteUrl("login")).toBe("https://plink.test/login");
  });

  it("passes absolute URLs through untouched", () => {
    expect(absoluteUrl("https://elsewhere.test/x")).toBe("https://elsewhere.test/x");
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in creator-supplied copy", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});

describe("verifyEmailTemplate", () => {
  it("embeds the confirmation link in both the button and the fallback", () => {
    const url = "https://plink.test/api/auth/verify-email?token=abc123";
    const { subject, html } = verifyEmailTemplate({ verifyUrl: url, name: "Maya" });

    expect(subject).toMatch(/confirm/i);
    expect(html).toContain(`href="${url.replace(/&/g, "&amp;")}"`);
    expect(html.match(/abc123/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Maya");
    expect(html).toContain("#171717");
    expect(html).toMatch(/^<!doctype html>/);
  });

  it("reads cleanly without a display name", () => {
    const { html } = verifyEmailTemplate({ verifyUrl: "https://plink.test/x", name: null });
    expect(html).not.toContain("Hi ,");
  });
});

describe("resetPasswordTemplate", () => {
  it("embeds the reset link and says how long it lasts", () => {
    const url = "https://plink.test/reset-password?token=xyz789";
    const { subject, html } = resetPasswordTemplate({ resetUrl: url });

    expect(subject).toMatch(/reset/i);
    expect(html).toContain("xyz789");
    expect(html).toContain("1 hour");
  });
});

describe("broadcastTemplate", () => {
  const base = {
    subject: "New drop",
    body: "Hey —\n\nFive new presets are live.",
    fromName: "Maya Rivera",
    unsubscribeUrl: "https://plink.test/api/unsubscribe?s=sub_1&t=sig",
  };

  it("always carries a working unsubscribe link", () => {
    const { html } = broadcastTemplate(base);
    expect(html).toContain("s=sub_1&amp;t=sig");
    expect(html).toMatch(/>Unsubscribe</);
  });

  it("keeps the creator's subject and splits blank lines into paragraphs", () => {
    const { subject, html } = broadcastTemplate(base);
    expect(subject).toBe("New drop");
    expect(html.match(/<p style="margin:0 0 16px/g)).toHaveLength(2);
  });

  it("escapes markup pasted into the body", () => {
    const { html } = broadcastTemplate({ ...base, body: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("adds the creator's page link when one is supplied", () => {
    const { html } = broadcastTemplate({ ...base, pageUrl: "https://plink.test/maya" });
    expect(html).toContain("https://plink.test/maya");
  });
});

describe("unsubscribe signatures", () => {
  it("round-trips a signature for the subscriber it was minted for", () => {
    const sig = unsubscribeSignature("sub_1");
    expect(sig).not.toContain("sub_1");
    expect(verifyUnsubscribeSignature("sub_1", sig)).toBe(true);
  });

  it("rejects a tampered signature or a swapped subscriber id", () => {
    const sig = unsubscribeSignature("sub_1");
    expect(verifyUnsubscribeSignature("sub_2", sig)).toBe(false);
    expect(verifyUnsubscribeSignature("sub_1", `${sig}x`)).toBe(false);
    expect(verifyUnsubscribeSignature("sub_1", "")).toBe(false);
  });

  it("builds an absolute link the route can parse", () => {
    const url = new URL(unsubscribeUrl("sub_1"));
    expect(url.pathname).toBe("/api/unsubscribe");
    expect(url.searchParams.get("s")).toBe("sub_1");
    expect(verifyUnsubscribeSignature("sub_1", url.searchParams.get("t") ?? "")).toBe(true);
  });
});
