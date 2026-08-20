"use client";

import * as React from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { TextArea, TextField } from "@plink/ui/field";
import { ImageUpload } from "@plink/ui/image-upload";
import { generatedAvatar } from "@plink/core/avatar";
import { cn, initialsOf } from "@plink/core/utils";
import { SOCIAL_PLATFORMS, socialPlatform } from "@plink/core/socials";
import { Button } from "@plink/ui/button";
import type { PublicSocial } from "@plink/core/profile-types";
import type { EditorProfile } from "@plink/core/editor-types";

export function ProfileEditor({
  profile,
  socials,
  onProfileChange,
  onAddSocial,
  onRemoveSocial,
}: {
  profile: EditorProfile;
  socials: PublicSocial[];
  onProfileChange: (patch: Partial<EditorProfile>) => void;
  onAddSocial: (platform: string, url: string) => void;
  onRemoveSocial: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const avatar = profile.avatarUrl || generatedAvatar(profile.username, initialsOf(profile.displayName));

  return (
    <section className="rounded-xl border border-line bg-surface shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-ink">{profile.displayName || profile.username}</p>
          <p className="truncate text-[13.5px] text-ink-muted">
            {profile.bio || "Add a bio so people know who you are"}
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13.5px] font-semibold text-ink sm:inline-flex">
          <Pencil className="size-3.5" /> Edit
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-line p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Display name"
              value={profile.displayName}
              onChange={(e) => onProfileChange({ displayName: e.target.value })}
              placeholder="Your name"
              maxLength={60}
            />
            <TextField
              label="Category"
              value={profile.category ?? ""}
              onChange={(e) => onProfileChange({ category: e.target.value })}
              placeholder="Food creator"
              maxLength={60}
            />
          </div>

          <div className="mt-4">
            <TextArea
              label="Bio"
              value={profile.bio}
              onChange={(e) => onProfileChange({ bio: e.target.value })}
              placeholder="One or two lines about what you do."
              maxLength={300}
              rows={2}
              hint={`${profile.bio.length}/300`}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ImageUpload
              label="Avatar"
              kind="avatar"
              shape="circle"
              value={profile.avatarUrl ?? ""}
              onChange={(url) => onProfileChange({ avatarUrl: url })}
              hint="Leave empty for a generated avatar."
            />
            <TextField
              label="Location"
              value={profile.location ?? ""}
              onChange={(e) => onProfileChange({ location: e.target.value })}
              placeholder="Lisbon"
              maxLength={80}
            />
          </div>

          <div className="mt-4">
            <ImageUpload
              label="Banner (optional)"
              kind="banner"
              shape="wide"
              value={profile.bannerUrl ?? ""}
              onChange={(url) => onProfileChange({ bannerUrl: url })}
            />
          </div>

          <SocialsEditor socials={socials} onAdd={onAddSocial} onRemove={onRemoveSocial} />
        </div>
      )}
    </section>
  );
}

function SocialsEditor({
  socials,
  onAdd,
  onRemove,
}: {
  socials: PublicSocial[];
  onAdd: (platform: string, url: string) => void;
  onRemove: (id: string) => void;
}) {
  const [platform, setPlatform] = React.useState(SOCIAL_PLATFORMS[0].id);
  const [value, setValue] = React.useState("");
  const active = socialPlatform(platform)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(platform, value.trim());
    setValue("");
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="font-mono text-[12px] leading-4 text-ink-muted">Social icons</p>

      {socials.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {socials.map((s) => {
            const p = socialPlatform(s.platform);
            if (!p) return null;
            const Icon = p.icon;
            return (
              <li key={s.id}>
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas py-1.5 pr-1.5 pl-3 text-[13.5px] font-semibold text-ink">
                  <Icon width={15} height={15} style={{ color: p.color }} />
                  {p.name}
                  <button
                    onClick={() => onRemove(s.id)}
                    aria-label={`Remove ${p.name}`}
                    className="grid size-6 place-items-center rounded-full text-ink-muted transition hover:bg-black/10 hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[9rem] flex-1">
          <label htmlFor="social-platform" className="field-label">Platform</label>
          <select
            id="social-platform"
            className="field"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[11rem] flex-[2]">
          <label htmlFor="social-value" className="field-label">Handle or link</label>
          <input
            id="social-value"
            className="field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={active.placeholder}
          />
        </div>
        <Button type="submit" variant="outline" size="md">Add</Button>
      </form>
    </div>
  );
}
