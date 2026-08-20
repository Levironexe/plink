"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { changePassword, changePlan, changeUsername, deleteAccount } from "@/app/dashboard/actions";
import { PLANS } from "@/lib/pricing";
import { cn, slugifyUsername } from "@/lib/utils";
import { useUsernameAvailability } from "@/lib/hooks";

export function SettingsView({
  username: initialUsername,
  email,
  plan: initialPlan,
  createdAt,
  counts,
}: {
  username: string;
  email: string;
  plan: string;
  createdAt: string;
  counts: { blocks: number; subscribers: number; products: number; views: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [plan, setPlan] = React.useState(initialPlan);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader title="Settings" description="Your account, your link and your plan." />

      <div className="mt-8 flex flex-col gap-5">
        <UsernamePanel initialUsername={initialUsername} />

        <Panel title="Account">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[13px] font-semibold text-ink-muted">Email</dt>
              <dd className="mt-0.5 text-[15px] font-semibold text-ink">{email}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold text-ink-muted">Member since</dt>
              <dd className="mt-0.5 text-[15px] font-semibold text-ink">
                {new Date(createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </dd>
            </div>
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Blocks", counts.blocks],
              ["Subscribers", counts.subscribers],
              ["Products", counts.products],
              ["Page views", counts.views],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl bg-canvas p-3.5">
                <p className="text-[12.5px] font-semibold text-ink-muted">{label}</p>
                <p className="mt-0.5 text-[20px] font-extrabold text-ink">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <PasswordPanel />

        <Panel title="Plan" description="Change your plan at any time. Downgrading never deletes your page.">
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((p) => {
              const active = plan === p.id;
              return (
                <button
                  key={p.id}
                  onClick={async () => {
                    const previous = plan;
                    setPlan(p.id);
                    const res = await changePlan(p.id);
                    if (!res.ok) {
                      setPlan(previous);
                      toast(res.error, "error");
                    } else {
                      toast(`You’re on ${p.name}`);
                      router.refresh();
                    }
                  }}
                  aria-pressed={active}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left transition",
                    active ? "border-ink bg-canvas" : "border-line hover:border-line-strong",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-extrabold text-ink">{p.name}</span>
                    {p.featured && <Crown className="size-4 text-brand-500" aria-hidden />}
                    {active && <Check className="size-4 text-ink" aria-hidden />}
                  </div>
                  <p className="mt-1 text-[13.5px] text-ink-muted">{p.tagline}</p>
                  <p className="mt-3 text-[20px] font-extrabold text-ink">
                    ${p.monthly}
                    <span className="text-[13px] font-medium text-ink-muted">/mo</span>
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-[13px] text-ink-muted">
            This build switches plans instantly so every feature can be tried. A production deployment would route this
            through a payment provider.
          </p>
        </Panel>

        <DangerPanel />
      </div>
    </div>
  );
}

function Panel({
  title, description, children, tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] border p-5 shadow-soft sm:p-6",
        tone === "danger" ? "border-coral/35 bg-[#fffaf9]" : "border-line bg-surface",
      )}
    >
      <h2 className={cn("text-[17px] font-bold", tone === "danger" ? "text-[#a5382a]" : "text-ink")}>{title}</h2>
      {description && <p className="mt-1 text-[14px] text-ink-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function UsernamePanel({ initialUsername }: { initialUsername: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState(initialUsername);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const { status } = useUsernameAvailability(value, initialUsername);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await changeUsername(value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast("Your link has been updated");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Your link" description="Changing this breaks any link you've already shared.">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <div className="flex items-center rounded-[14px] border border-line-strong bg-surface pr-3 focus-within:border-brand-500">
            <span className="py-2.5 pl-3.5 text-[15px] font-medium text-ink-muted">plink.to/</span>
            <input
              value={value}
              onChange={(e) => setValue(slugifyUsername(e.target.value))}
              aria-label="Username"
              spellCheck={false}
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-0.5 text-[15px] font-semibold text-ink outline-none"
            />
            {status === "checking" && <LoaderCircle className="size-4 animate-spin text-ink-muted" />}
            {status === "available" && <Check className="size-4 text-[#16a34a]" />}
            {status === "taken" && <X className="size-4 text-coral" />}
          </div>
        </div>
        <Button
          onClick={save}
          loading={saving}
          disabled={value === initialUsername || status === "taken" || value.length < 3}
        >
          Save
        </Button>
      </div>
      {error && <p className="mt-2 text-[13.5px] font-medium text-coral">{error}</p>}
    </Panel>
  );
}

function PasswordPanel() {
  const { toast } = useToast();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [errors, setErrors] = React.useState<{ current?: string; next?: string }>({});
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const res = await changePassword(current, next);
      if (!res.ok) {
        setErrors({ [res.field ?? "next"]: res.error });
        return;
      }
      setCurrent("");
      setNext("");
      toast("Password changed — other devices have been signed out");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Password">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Current password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          error={errors.current}
          required
        />
        <TextField
          label="New password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          error={errors.next}
          required
        />
        <div className="sm:col-span-2">
          <Button type="submit" variant="outline" loading={saving} disabled={!current || next.length < 8}>
            Change password
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function DangerPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    setDeleting(true);
    try {
      const res = await deleteAccount();
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Panel
        tone="danger"
        title="Delete account"
        description="Removes your page, links, subscribers and orders. This cannot be undone."
      >
        <Button variant="danger" onClick={() => setOpen(true)}>
          <TriangleAlert className="size-4" /> Delete my account
        </Button>
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        description="Your page will stop working immediately and your subscriber list will be erased."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Keep my account</Button>
            <Button variant="danger" onClick={remove} loading={deleting} disabled={confirm !== "DELETE"}>
              Delete forever
            </Button>
          </>
        }
      >
        <TextField
          label="Type DELETE to confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
        />
      </Modal>
    </>
  );
}
