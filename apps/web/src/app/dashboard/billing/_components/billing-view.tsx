"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Banknote, Check, Info, RefreshCw } from "lucide-react";
import { Button } from "@plink/ui/button";
import { useToast } from "@plink/ui/toast";
import { PageHeader } from "../../_components/page-header";
import { PLANS } from "@plink/core/pricing";
import { cn, formatMoney } from "@plink/core/utils";

type Interval = "month" | "year";

type ConnectStatus = {
  connected: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: number;
};

export function BillingView({
  configured,
  plan,
  planStatus,
  planInterval,
  planRenewsAt,
  connected,
  payoutsEnabled,
  sales,
}: {
  configured: boolean;
  plan: string;
  planStatus: string;
  planInterval: string | null;
  planRenewsAt: string | null;
  connected: boolean;
  payoutsEnabled: boolean;
  sales: { orders: number; revenueCents: number };
}) {
  const current = PLANS.find((p) => p.id === plan) ?? PLANS[0];

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Billing"
        description="Your Plink plan, and the account your sales are paid into."
      />

      <div className="mt-8 flex flex-col gap-4">
        {!configured && <NotConfigured />}

        <Panel eyebrow="Current plan">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[20px] leading-7 font-semibold text-ink">{current.name}</h2>
                <StatusPill status={planStatus} />
              </div>
              <p className="mt-1 text-[14px] text-ink-soft">{current.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-[24px] leading-8 font-semibold text-ink">
                ${planInterval === "year" ? current.yearly : current.monthly}
                <span className="text-[13px] font-normal text-ink-muted">
                  {planInterval === "year" ? "/yr" : "/mo"}
                </span>
              </p>
              {planRenewsAt && (
                <p className="eyebrow mt-1">
                  {planStatus === "canceled" ? "ends" : "renews"} {formatDate(planRenewsAt)}
                </p>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5">
            <Stat label="Paid orders" value={String(sales.orders)} />
            <Stat label="Gross sales" value={formatMoney(sales.revenueCents)} />
          </dl>
        </Panel>

        <PlanPicker configured={configured} plan={plan} planInterval={planInterval} />

        <PayoutsPanel
          configured={configured}
          connected={connected}
          payoutsEnabled={payoutsEnabled}
          plan={plan}
        />
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <section className="rounded-card border border-line bg-canvas-deep p-5 shadow-soft sm:p-6">
      <div className="flex gap-3">
        <Info className="mt-0.5 size-[18px] shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0">
          <p className="eyebrow">Payments</p>
          <h2 className="mt-1 text-[16px] leading-6 font-semibold text-ink">Payments not configured</h2>
          <p className="mt-1.5 text-[14px] leading-5 text-ink-soft">
            Checkout, tips and plan upgrades are switched off until Stripe has keys to work with. Add
            <code className="mx-1 rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink">
              STRIPE_SECRET_KEY
            </code>
            to <span className="font-mono text-[13px]">.env.local</span> and restart the dev server. Everything else on
            this page keeps working.
          </p>
        </div>
      </div>
    </section>
  );
}

function PlanPicker({
  configured,
  plan,
  planInterval,
}: {
  configured: boolean;
  plan: string;
  planInterval: string | null;
}) {
  const { toast } = useToast();
  const [interval, setInterval] = React.useState<Interval>(planInterval === "year" ? "year" : "month");
  const [pending, setPending] = React.useState<string | null>(null);

  async function upgrade(target: "pro" | "vip") {
    setPending(target);
    try {
      const res = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target, interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast(data.error ?? "Could not start checkout", "error");
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast("Could not start checkout", "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <Panel
      eyebrow="Change plan"
      action={
        <div className="inline-flex rounded-md border border-line p-0.5" role="group" aria-label="Billing interval">
          {(["month", "year"] as Interval[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              aria-pressed={interval === value}
              className={cn(
                "rounded-sm px-3 py-1 text-[13px] font-medium transition-colors duration-150",
                interval === value ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
              )}
            >
              {value === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const active = p.id === plan;
          const price = interval === "year" ? p.yearly : p.monthly;
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-md border p-4",
                active ? "border-ink bg-canvas-deep" : "border-line bg-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-ink">{p.name}</span>
                {active && <Check className="size-4 text-ink" aria-hidden />}
              </div>
              <p className="mt-2 text-[22px] leading-7 font-semibold text-ink">
                ${price}
                <span className="text-[13px] font-normal text-ink-muted">
                  {interval === "year" ? "/yr" : "/mo"}
                </span>
              </p>
              <p className="mt-1.5 flex-1 text-[13px] leading-5 text-ink-soft">{p.tagline}</p>

              <div className="mt-4">
                {active ? (
                  <Button variant="secondary" size="sm" fullWidth disabled>
                    Current plan
                  </Button>
                ) : p.id === "free" ? (
                  <p className="text-[13px] text-ink-muted">
                    Cancel from the Stripe receipt email to drop back to Free.
                  </p>
                ) : (
                  <Button
                    size="sm"
                    fullWidth
                    disabled={!configured}
                    loading={pending === p.id}
                    onClick={() => upgrade(p.id as "pro" | "vip")}
                  >
                    {p.id === "vip" && plan === "pro" ? "Upgrade" : p.cta}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function PayoutsPanel({
  configured,
  connected,
  payoutsEnabled,
  plan,
}: {
  configured: boolean;
  connected: boolean;
  payoutsEnabled: boolean;
  plan: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<ConnectStatus>({
    connected,
    payoutsEnabled,
    chargesEnabled: payoutsEnabled,
    detailsSubmitted: connected,
    requirementsDue: 0,
  });
  const [starting, setStarting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  async function startOnboarding() {
    setStarting(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast(data.error ?? "Could not start payout onboarding", "error");
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast("Could not start payout onboarding", "error");
    } finally {
      setStarting(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/connect/status");
      const data = (await res.json()) as Partial<ConnectStatus> & { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Could not read your payout account", "error");
        return;
      }
      setStatus({
        connected: Boolean(data.connected),
        payoutsEnabled: Boolean(data.payoutsEnabled),
        chargesEnabled: Boolean(data.chargesEnabled),
        detailsSubmitted: Boolean(data.detailsSubmitted),
        requirementsDue: data.requirementsDue ?? 0,
      });
      router.refresh();
    } catch {
      toast("Could not read your payout account", "error");
    } finally {
      setRefreshing(false);
    }
  }

  const feeCopy =
    plan === "free"
      ? "Free plans pay a 5% platform fee on each sale. Pro and Studio pay 0%."
      : "You pay 0% platform fee — only the processor's own fee applies.";

  return (
    <Panel
      eyebrow="Payouts"
      action={
        configured && status.connected ? (
          <Button variant="ghost" size="sm" onClick={refresh} loading={refreshing}>
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-canvas-deep text-ink-soft">
            {status.payoutsEnabled ? (
              <BadgeCheck className="size-[18px]" aria-hidden />
            ) : (
              <Banknote className="size-[18px]" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ink">
              {!configured
                ? "Payouts unavailable"
                : status.payoutsEnabled
                  ? "Payouts are live"
                  : status.connected
                    ? "Onboarding incomplete"
                    : "Not connected"}
            </p>
            <p className="mt-1 max-w-md text-[13.5px] leading-5 text-ink-soft">
              {!configured
                ? "Connect onboarding needs Stripe keys before it can run."
                : status.payoutsEnabled
                  ? "Sales and tips settle straight into your Stripe account."
                  : status.connected
                    ? `Stripe still needs a few details${status.requirementsDue > 0 ? ` (${status.requirementsDue} outstanding)` : ""} before it can pay you out.`
                    : "Connect a Stripe account so money from your page reaches your bank."}
            </p>
            <p className="mt-2 text-[13px] text-ink-muted">{feeCopy}</p>
          </div>
        </div>

        {configured && !status.payoutsEnabled && (
          <Button size="sm" onClick={startOnboarding} loading={starting}>
            {status.connected ? "Finish setup" : "Set up payouts"}
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </Panel>
  );
}

function Panel({
  eyebrow,
  action,
  children,
}: {
  eyebrow: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{eyebrow}</p>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[18px] leading-6 font-semibold text-ink">{value}</dd>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
};

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "past_due"
      ? "border-warning/40 bg-warning-soft text-warning-deep"
      : status === "canceled"
        ? "border-line bg-canvas-deep text-ink-soft"
        : "border-line bg-canvas-deep text-ink-soft";

  return (
    <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[11px] tracking-tight", tone)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
