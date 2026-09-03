"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@plink/ui/button";
import { createWorkspace } from "../actions";

/** Inline create form — used in the empty state and above the workspace list. */
export function CreateWorkspaceForm({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createWorkspace(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <label htmlFor="workspace-name" className="field-label">
        Workspace name
      </label>
      <div className="flex gap-2">
        <input
          id="workspace-name"
          className="field"
          placeholder="e.g. Nova Studio Clients"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoFocus={autoFocus}
        />
        <Button type="submit" loading={pending} disabled={!name.trim()}>
          Create
        </Button>
      </div>
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
    </form>
  );
}
