"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, ChartColumn, MousePointerClick, Eye, Users, Wallet } from "lucide-react";
import { RANGES } from "@/lib/analytics-shared";
import type { AnalyticsSummary } from "@/lib/analytics";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { cn, compactNumber, formatMoney, hostOf } from "@/lib/utils";

const DEVICE_COLORS = ["#6c4cff", "#4cc9f0", "#ffd166"];

export function AnalyticsView({ data, username }: { data: AnalyticsSummary; username: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("range") ?? "30d";

  function setRange(range: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", range);
    router.push(`/dashboard/analytics?${next.toString()}`);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Analytics"
        description="Views, clicks and where your traffic comes from."
        actions={
          <div className="inline-flex rounded-2xl border border-line bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                aria-pressed={active === r.id}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition",
                  active === r.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Eye} label="Page views" value={compactNumber(data.totals.views)} delta={data.deltas.views} />
        <Stat icon={MousePointerClick} label="Link clicks" value={compactNumber(data.totals.clicks)} delta={data.deltas.clicks} />
        <Stat icon={ChartColumn} label="Click-through rate" value={`${data.totals.ctr}%`} />
        <Stat icon={Users} label="Subscribers" value={compactNumber(data.totals.subscribers)} />
      </div>

      {!data.hasData ? (
        <div className="mt-8">
          <EmptyState
            icon={ChartColumn}
            title="No traffic yet"
            body="Share your link and the numbers will start filling in. Every view and tap is counted here."
            action={
              <Link
                href={`/${username}`}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-[15px] font-semibold text-white"
              >
                Open my page
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-[24px] border border-line bg-surface p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold text-ink">Traffic over time</h2>
              <div className="flex items-center gap-4 text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span className="size-2.5 rounded-full bg-brand-500" /> Views
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span className="size-2.5 rounded-full bg-sky" /> Clicks
                </span>
              </div>
            </div>
            <div className="mt-6 h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6c4cff" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#6c4cff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4cc9f0" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4cc9f0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeebe6" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#767585" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#767585" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #e9e6e1",
                      boxShadow: "0 12px 32px -12px rgba(11,11,16,0.2)",
                      fontSize: 13,
                    }}
                  />
                  {/* Entry animation is off: recharts reveals a series with an animated clip
                      rect, which can stall in a background tab and leave the chart blank. */}
                  <Area type="monotone" dataKey="views" stroke="#6c4cff" strokeWidth={2.5} fill="url(#gv)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="clicks" stroke="#4cc9f0" strokeWidth={2.5} fill="url(#gc)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft sm:p-6">
              <h2 className="text-[17px] font-bold text-ink">Top links</h2>
              <div className="mt-5 flex flex-col gap-3">
                {data.topLinks.slice(0, 8).map((link) => {
                  const max = data.topLinks[0]?.clicks || 1;
                  return (
                    <div key={link.id}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">
                          {link.title}
                          {!link.visible && <span className="ml-2 text-[12px] font-medium text-ink-muted">hidden</span>}
                        </span>
                        <span className="shrink-0 text-[13.5px] font-bold text-ink-muted">
                          {compactNumber(link.clicks)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                            style={{ width: `${Math.max(2, (link.clicks / max) * 100)}%` }}
                          />
                        </div>
                        {link.url && (
                          <span className="shrink-0 text-[12px] text-ink-muted">{hostOf(link.url)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {data.topLinks.length === 0 && (
                  <p className="text-[14px] text-ink-muted">No links to rank yet.</p>
                )}
              </div>
            </section>

            <div className="flex flex-col gap-6">
              <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft sm:p-6">
                <h2 className="text-[17px] font-bold text-ink">Devices</h2>
                <div className="mt-2 h-[168px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.devices}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={68}
                        paddingAngle={2}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {data.devices.map((_, i) => (
                          <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e9e6e1" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {data.devices.map((d, i) => (
                    <li key={d.name} className="flex items-center justify-between text-[13.5px]">
                      <span className="inline-flex items-center gap-2 text-ink-soft capitalize">
                        <span className="size-2.5 rounded-full" style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                        {d.name}
                      </span>
                      <span className="font-bold text-ink">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft sm:p-6">
                <h2 className="text-[17px] font-bold text-ink">Where they came from</h2>
                <ul className="mt-4 space-y-2.5">
                  {data.referrers.map((r) => (
                    <li key={r.name} className="flex items-center justify-between text-[14px]">
                      <span className="truncate text-ink-soft">{r.name}</span>
                      <span className="shrink-0 font-bold text-ink">{r.value}</span>
                    </li>
                  ))}
                  {data.referrers.length === 0 && <li className="text-[14px] text-ink-muted">Nothing yet.</li>}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <p className="inline-flex items-center gap-2 text-[13px] font-bold tracking-wider text-ink-muted uppercase">
            <Wallet className="size-3.5" aria-hidden /> Revenue in range
          </p>
          <p className="mt-2 text-[32px] leading-none font-extrabold text-ink">
            {formatMoney(data.totals.revenueCents)}
          </p>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">{data.totals.orders} orders and tips</p>
        </div>
        <div className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <p className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">Reporting window</p>
          <p className="mt-2 text-[16px] font-semibold text-ink">
            {data.from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} —{" "}
            {data.to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Free plans keep 7 days of history. Pro keeps everything.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: number;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-canvas text-ink-soft">
          <Icon className="size-[17px]" />
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold",
              up ? "bg-[#e9fbef] text-[#15803d]" : "bg-[#fff1ee] text-[#c2410c]",
            )}
          >
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-[30px] leading-none font-extrabold text-ink">{value}</p>
      <p className="mt-1.5 text-[13.5px] font-medium text-ink-muted">{label}</p>
    </div>
  );
}
