"use client";

import * as React from "react";
import { Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea, TextField, Toggle } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { createProduct, deleteProduct, updateProduct } from "@/app/dashboard/actions";
import { cn, formatMoney, relativeTime } from "@/lib/utils";
import { generatedAvatar } from "@/lib/avatar";

export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  fileUrl: string | null;
  type: string;
  published: boolean;
  sales: number;
  createdAt: string;
};

export type StoreOrder = {
  id: string;
  email: string;
  amountCents: number;
  productName: string | null;
  createdAt: string;
};

const TYPES = [
  { id: "digital", label: "Digital download" },
  { id: "service", label: "Service / session" },
  { id: "membership", label: "Membership" },
];

const emptyDraft = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  fileUrl: "",
  type: "digital",
  published: true,
};

export function StoreView({
  products: initialProducts,
  orders,
  revenueCents,
  orderCount,
  plan,
}: {
  products: StoreProduct[];
  /** Most recent orders only — `orderCount` is the lifetime total. */
  orders: StoreOrder[];
  revenueCents: number;
  orderCount: number;
  plan: string;
}) {
  const { toast } = useToast();
  const [products, setProducts] = React.useState(initialProducts);
  const [editing, setEditing] = React.useState<StoreProduct | null>(null);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(emptyDraft);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const limit = plan === "free" ? 3 : Infinity;
  const atLimit = products.length >= limit;

  function openNew() {
    setEditing(null);
    setDraft(emptyDraft);
    setError("");
    setOpen(true);
  }

  function openEdit(p: StoreProduct) {
    setEditing(p);
    setDraft({
      name: p.name,
      description: p.description,
      price: (p.priceCents / 100).toString(),
      imageUrl: p.imageUrl ?? "",
      fileUrl: p.fileUrl ?? "",
      type: p.type,
      published: p.published,
    });
    setError("");
    setOpen(true);
  }

  async function save() {
    setError("");
    const priceCents = Math.round(Number(draft.price || 0) * 100);
    if (!draft.name.trim()) {
      setError("Give your product a name");
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError("Enter a valid price");
      return;
    }

    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      priceCents,
      currency: "USD",
      imageUrl: draft.imageUrl.trim() || null,
      fileUrl: draft.fileUrl.trim() || null,
      type: draft.type,
      published: draft.published,
    };

    try {
      if (editing) {
        const res = await updateProduct(editing.id, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setProducts((prev) =>
          prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)),
        );
        toast("Product updated");
      } else {
        const res = await createProduct(payload);
        if (!res.ok || !res.data) {
          setError(res.ok ? "Could not save" : res.error);
          return;
        }
        setProducts((prev) => [
          {
            id: res.data!.id,
            ...payload,
            sales: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast("Product added");
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const snapshot = products;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    const res = await deleteProduct(id);
    if (!res.ok) {
      setProducts(snapshot);
      toast(res.error, "error");
    } else {
      toast("Product removed");
    }
  }

  async function togglePublished(p: StoreProduct) {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, published: !x.published } : x)));
    const res = await updateProduct(p.id, {
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      currency: p.currency,
      imageUrl: p.imageUrl,
      fileUrl: p.fileUrl,
      type: p.type,
      published: !p.published,
    });
    if (!res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, published: p.published } : x)));
      toast(res.error, "error");
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Store"
        description="Sell digital products, sessions and memberships straight from your page."
        actions={
          <Button onClick={openNew} disabled={atLimit}>
            <Plus className="size-4" /> New product
          </Button>
        }
      />

      {atLimit && (
        <p className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-[14px] font-medium text-brand-800">
          The Free plan includes 3 products. Upgrade to Pro for unlimited products and 0% platform fee.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric label="Revenue" value={formatMoney(revenueCents)} />
        <Metric label="Orders" value={orderCount.toString()} />
        <Metric label="Products" value={products.length.toString()} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="text-[17px] font-bold text-ink">Products</h2>
          {products.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={ShoppingBag}
                title="No products yet"
                body="Add a preset pack, an ebook, a template or a 1:1 session — then drop a Product block on your page."
                action={<Button onClick={openNew}><Plus className="size-4" /> Add a product</Button>}
              />
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {products.map((p) => (
                <article
                  key={p.id}
                  className={cn(
                    "flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-soft",
                    !p.published && "opacity-65",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl || generatedAvatar(p.id)}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-bold text-ink">{p.name}</p>
                    <p className="truncate text-[13.5px] text-ink-muted">
                      {p.description || TYPES.find((t) => t.id === p.type)?.label}
                    </p>
                    <p className="mt-1 text-[12.5px] font-semibold text-ink-muted">
                      {p.sales} sold · {p.published ? "Live" : "Hidden"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-canvas px-3 py-1.5 text-[13.5px] font-bold text-ink">
                    {p.priceCents === 0 ? "Free" : formatMoney(p.priceCents, p.currency)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => togglePublished(p)}
                      aria-label={p.published ? "Hide product" : "Publish product"}
                      className="rounded-lg px-2 py-1.5 text-[12.5px] font-bold text-ink-muted transition hover:bg-black/5 hover:text-ink"
                    >
                      {p.published ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      aria-label={`Delete ${p.name}`}
                      className="rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-coral"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-ink">Recent orders</h2>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
            {orders.length === 0 && (
              <p className="px-5 py-8 text-center text-[14px] text-ink-muted">No orders yet.</p>
            )}
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">{o.productName ?? "Tip"}</p>
                  <p className="truncate text-[12.5px] text-ink-muted">
                    {o.email} · {relativeTime(o.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-bold text-ink">{formatMoney(o.amountCents)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit product" : "New product"}
        description="This appears wherever you place a Product block."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? "Save changes" : "Add product"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="The Design System Starter"
            error={error && !draft.name.trim() ? error : undefined}
          />
          <TextArea
            label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="62 Figma components + tokens, ready to fork."
            rows={2}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Price (USD)"
              type="number"
              min={0}
              step="0.01"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="49"
              hint="Enter 0 for a free download."
            />
            <div>
              <label htmlFor="product-type" className="field-label">Type</label>
              <select
                id="product-type"
                className="field"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <TextField
            label="Cover image URL"
            value={draft.imageUrl}
            onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
            placeholder="https://…/cover.jpg"
          />
          <TextField
            label="Delivery URL"
            value={draft.fileUrl}
            onChange={(e) => setDraft({ ...draft, fileUrl: e.target.value })}
            placeholder="https://…/download.zip"
            hint="Where buyers are sent after checkout."
          />
          <Toggle
            checked={draft.published}
            onChange={(v) => setDraft({ ...draft, published: v })}
            label="Published"
            description="Hidden products stay in your store but never show on your page."
          />
          {error && draft.name.trim() && (
            <p className="text-[13.5px] font-medium text-coral">{error}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
      <p className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-2 text-[30px] leading-none font-extrabold text-ink">{value}</p>
    </div>
  );
}
