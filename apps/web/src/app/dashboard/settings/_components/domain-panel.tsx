"use client";

import * as React from "react";
import { Check, CircleCheck, Copy, Globe, RefreshCw, TriangleAlert, Unlink } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";
import type { DnsRecord } from "@plink/core/domains";
import { cn } from "@plink/core/utils";

type DomainState = {
  domain: string | null;
  verified: boolean;
  verifiedAt: string | null;
  records: DnsRecord[];
};

/**
 * Connect a custom domain. Three states: nothing connected, connected but
 * waiting on DNS, and verified. The records shown here come straight from the
 * API, which is the same source the verifier checks against.
 */
export function DomainPanel({
  username,
  domain: initialDomain = null,
  verifiedAt: initialVerifiedAt = null,
  records: initialRecords = [],
  plan,
  className,
}: {
  username: string;
  domain?: string | null;
  verifiedAt?: string | null;
  records?: DnsRecord[];
  /** Custom domains are a paid feature; "free" shows the upgrade nudge. */
  plan?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [state, setState] = React.useState<DomainState>({
    domain: initialDomain,
    verified: Boolean(initialVerifiedAt),
    verifiedAt: initialVerifiedAt,
    records: initialRecords,
  });
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"connect" | "verify" | "remove" | null>(null);

  const locked = plan === "free";

  async function call(method: "PUT" | "POST" | "DELETE", body?: unknown) {
    const res = await fetch("/api/domain/verify", {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await res.json().catch(() => null)) as
      | (Partial<DomainState> & { error?: string })
      | null;
    return { ok: res.ok, payload };
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("connect");
    try {
      const { ok, payload } = await call("PUT", { domain: input });
      if (!ok || !payload) {
        setError(payload?.error ?? "Could not connect that domain");
        return;
      }
      setState({
        domain: payload.domain ?? null,
        verified: Boolean(payload.verified),
        verifiedAt: payload.verifiedAt ?? null,
        records: payload.records ?? [],
      });
      setInput("");
      toast("Domain added — now add the DNS records");
    } catch {
      setError("Could not connect that domain");
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setError(null);
    setBusy("verify");
    try {
      const { ok, payload } = await call("POST");
      if (!ok || !payload) {
        setError(payload?.error ?? "Not verified yet");
        if (payload?.records) setState((s) => ({ ...s, records: payload.records ?? s.records }));
        return;
      }
      setState({
        domain: payload.domain ?? null,
        verified: true,
        verifiedAt: payload.verifiedAt ?? null,
        records: payload.records ?? [],
      });
      toast("Domain verified — your page is live on it");
    } catch {
      setError("Could not reach DNS just now");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      const { ok } = await call("DELETE");
      if (!ok) {
        toast("Could not disconnect that domain", "error");
        return;
      }
      setState({ domain: null, verified: false, verifiedAt: null, records: [] });
      setError(null);
      toast("Domain disconnected");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={cn("rounded-[24px] border border-line bg-surface p-5 shadow-soft", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft">
          <Globe className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-ink">Custom domain</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            Serve your page from your own domain instead of plink.to/{username}.
          </p>
        </div>
        {state.domain && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
              state.verified ? "bg-brand-50 text-brand-700" : "bg-warning-soft text-warning-deep",
            )}
          >
            {state.verified ? "Verified" : "Pending DNS"}
          </span>
        )}
      </div>

      {locked && (
        <p className="mt-4 rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink-soft">
          Custom domains are part of Pro. Upgrade below to connect one.
        </p>
      )}

      {/* ── No domain yet ─────────────────────────────────────────────── */}
      {!state.domain && (
        <form onSubmit={connect} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <TextField
              label="Domain"
              placeholder="links.yourdomain.com"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              error={error ?? undefined}
              hint={error ? undefined : "No https://, no path — just the hostname."}
              disabled={locked}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" loading={busy === "connect"} disabled={locked || input.trim().length === 0}>
            Connect
          </Button>
        </form>
      )}

      {/* ── Connected ─────────────────────────────────────────────────── */}
      {state.domain && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5">
            {state.verified ? (
              <CircleCheck className="size-4 shrink-0 text-brand-500" aria-hidden />
            ) : (
              <TriangleAlert className="size-4 shrink-0 text-warning-deep" aria-hidden />
            )}
            <a
              href={`https://${state.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink hover:underline"
            >
              {state.domain}
            </a>
            {!state.verified && (
              <Button variant="secondary" size="sm" onClick={verify} loading={busy === "verify"}>
                <RefreshCw className="size-4" aria-hidden /> Verify
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={remove} loading={busy === "remove"}>
              <Unlink className="size-4" aria-hidden /> Disconnect
            </Button>
          </div>

          {error && !state.verified && (
            <p className="mt-2 text-[13px] font-medium text-coral">{error}</p>
          )}

          {state.verified ? (
            <p className="mt-3 text-[13px] text-ink-muted">
              Verified{" "}
              {state.verifiedAt
                ? new Date(state.verifiedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "just now"}
              . You can remove the TXT record if you like — the CNAME has to stay.
            </p>
          ) : (
            <>
              <p className="mt-4 text-[13px] font-medium text-ink-soft">
                Add these at your DNS provider, then hit Verify. Propagation usually takes a few
                minutes.
              </p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="bg-canvas">
                      {["Type", "Name", "Value", "TTL"].map((head) => (
                        <th
                          key={head}
                          className="px-3 py-2 font-mono text-[12px] font-normal text-ink-soft uppercase"
                        >
                          {head}
                        </th>
                      ))}
                      <th className="px-3 py-2">
                        <span className="sr-only">Copy</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.records.map((record) => (
                      <tr key={`${record.type}-${record.name}`} className="border-t border-line align-top">
                        <td className="px-3 py-2.5 text-[13px] font-semibold text-ink">{record.type}</td>
                        <td className="px-3 py-2.5 font-mono text-[13px] text-ink">{record.name}</td>
                        <td className="px-3 py-2.5 font-mono text-[13px] break-all text-ink">
                          {record.value}
                          {record.hint && (
                            <span className="mt-0.5 block font-sans text-[12px] text-ink-muted">
                              {record.hint}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[13px] text-ink-muted">{record.ttl}</td>
                        <td className="px-3 py-2.5">
                          <CopyValue value={record.value} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function CopyValue({ value }: { value: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast("Copied");
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast("Couldn’t copy — select it manually", "error");
        }
      }}
      className="rounded-md p-1.5 text-ink-muted transition hover:bg-canvas-deep hover:text-ink"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
