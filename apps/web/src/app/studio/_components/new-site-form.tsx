"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@plink/ui/button";
import { Modal } from "@plink/ui/modal";
import { TextField } from "@plink/ui/field";
import { cn } from "@plink/core/utils";
import { SITE_TEMPLATES, type SiteTemplateId } from "@plink/core/site-schema";
import { createSite } from "../actions";

const TEMPLATE_COPY: Record<SiteTemplateId, { label: string; blurb: string }> = {
  editorial: { label: "Editorial", blurb: "Long-form layout with generous type" },
  storefront: { label: "Storefront", blurb: "Product-first and commerce-ready" },
  portfolio: { label: "Portfolio", blurb: "Visual grid for showcasing work" },
};

/** "New site" button + modal: name, template picker, optional client fields. */
export function NewSiteButton({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [template, setTemplate] = React.useState<SiteTemplateId>("editorial");
  const [clientName, setClientName] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSite(workspaceId, { name, template, clientName, clientEmail });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setClientName("");
      setClientEmail("");
      setTemplate("editorial");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        New site
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New client site"
        description={`A fresh site in ${workspaceName} — the brief and editor come next.`}
      >
        <form onSubmit={submit} className="space-y-5">
          <TextField
            label="Site name"
            placeholder="e.g. Marta Ceramics"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
          />

          <fieldset>
            <legend className="field-label">Template</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {SITE_TEMPLATES.map((id) => (
                <label
                  key={id}
                  className={cn(
                    "cursor-pointer rounded-md border p-3 transition-colors",
                    template === id
                      ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]"
                      : "border-line hover:border-line-strong/50",
                  )}
                >
                  <input
                    type="radio"
                    name="template"
                    value={id}
                    checked={template === id}
                    onChange={() => setTemplate(id)}
                    className="sr-only"
                  />
                  <span className="block text-[14px] font-medium tracking-[-0.02em] text-ink">
                    {TEMPLATE_COPY[id].label}
                  </span>
                  <span className="mt-1 block text-[12px] leading-4 text-ink-muted">{TEMPLATE_COPY[id].blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Client name"
              placeholder="Optional"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              maxLength={120}
            />
            <TextField
              label="Client email"
              type="email"
              placeholder="Optional"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              maxLength={200}
            />
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Create site
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
