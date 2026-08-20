"use client";

import * as React from "react";
import {
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  LoaderCircle,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@plink/core/utils";
import type { UploadKind } from "@plink/storage";

/* ── Transport ────────────────────────────────────────────────────────────── */
/* Shared by ImageUpload. XHR rather than fetch: only XHR reports upload
   progress, and a creator dropping a 90 MB product file needs to see it move. */

export type UploadedFile = {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
  downloadUrl?: string;
  name?: string;
};

export type UploadOptions = {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

const GENERIC_ERROR = "The upload didn't go through. Please try again.";

export function uploadToStore(
  file: File,
  kind: UploadKind,
  { onProgress, signal }: UploadOptions = {},
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      const payload: unknown = xhr.response;
      const data = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;

      if (xhr.status >= 200 && xhr.status < 300 && typeof data?.url === "string") {
        onProgress?.(100);
        resolve({
          url: data.url,
          pathname: String(data.pathname ?? ""),
          size: Number(data.size ?? file.size),
          contentType: String(data.contentType ?? file.type),
          downloadUrl: typeof data.downloadUrl === "string" ? data.downloadUrl : undefined,
          name: file.name,
        });
        return;
      }

      const message = typeof data?.error === "string" ? data.error : null;
      reject(new Error(message ?? (xhr.status === 413 ? "That file is too large to upload." : GENERIC_ERROR)));
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network problem — check your connection and try again.")),
    );
    xhr.addEventListener("abort", () => reject(new DOMException("Upload cancelled", "AbortError")));

    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Upload cancelled", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(body);
  });
}

/** Mirrors src/lib/upload.ts. The server is the source of truth; these only
    drive the file picker's filter and the friendly pre-flight message. */
export const DOCUMENT_ACCEPT =
  "application/pdf,application/zip,application/x-zip-compressed,application/epub+zip,audio/mpeg,video/mp4,.pdf,.zip,.epub,.mp3,.mp4";
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[i]}`;
}

/* ── Presentation helpers ─────────────────────────────────────────────────── */

/** Declared at module scope so the glyph never remounts mid-upload. */
function FileGlyph({ type, name, className }: { type: string; name: string; className?: string }) {
  const hay = `${type} ${name}`.toLowerCase();
  if (hay.includes("zip") || hay.includes("epub")) return <FileArchive className={className} />;
  if (hay.includes("audio") || hay.includes(".mp3")) return <FileAudio className={className} />;
  if (hay.includes("video") || hay.includes(".mp4")) return <FileVideo className={className} />;
  if (hay.includes("pdf")) return <FileText className={className} />;
  return <Paperclip className={className} />;
}

/** `…/u/abc/product-file/guide-x8f2.pdf` → `guide-x8f2.pdf`. */
function nameFromUrl(url: string) {
  try {
    const path = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
    return decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "") || "Attached file";
  } catch {
    return "Attached file";
  }
}

function extensionOf(name: string, type: string) {
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (ext && ext.length <= 8) return ext.toUpperCase();
  const sub = type.split("/")[1];
  return sub ? sub.toUpperCase() : "FILE";
}

/* ── Component ────────────────────────────────────────────────────────────── */

export type FileUploadProps = {
  /** Stored file URL, or "" when nothing is attached. */
  value?: string | null;
  /** Fires with the new URL ("" on remove) plus the upload metadata when known. */
  onChange: (url: string, meta: UploadedFile | null) => void;
  kind?: UploadKind;
  label?: string;
  hint?: string;
  /** Display name for an already-stored file, when the caller persisted one. */
  fileName?: string | null;
  /** Display size in bytes for an already-stored file. */
  fileSize?: number | null;
  /** `<input accept>` override. Defaults to the document allowlist. */
  accept?: string;
  /** Client-side size hint in bytes. The server still enforces its own cap. */
  maxBytes?: number;
  /** Show the "or paste a file URL" fallback. Defaults to true. */
  allowUrl?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function FileUpload({
  value,
  onChange,
  kind = "product-file",
  label,
  hint,
  fileName,
  fileSize,
  accept = DOCUMENT_ACCEPT,
  maxBytes = MAX_DOCUMENT_BYTES,
  allowUrl = true,
  disabled,
  className,
  id: providedId,
}: FileUploadProps) {
  const reactId = React.useId();
  const id = providedId ?? reactId;
  const inputId = `${id}-file`;
  const urlId = `${id}-url`;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [local, setLocal] = React.useState<{ name: string; size: number; type: string } | null>(null);

  const busy = progress !== null;
  const url = value ?? "";
  const displayName = local?.name ?? fileName ?? (url ? nameFromUrl(url) : "");
  const displaySize = local?.size ?? fileSize ?? null;
  const displayType = local?.type ?? "";

  const send = React.useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > maxBytes) {
        setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.`);
        return;
      }

      setLocal({ name: file.name, size: file.size, type: file.type });
      setProgress(0);
      try {
        const result = await uploadToStore(file, kind, { onProgress: setProgress });
        onChange(result.url, result);
      } catch (err) {
        setLocal(null);
        setError(err instanceof Error ? err.message : GENERIC_ERROR);
      } finally {
        setProgress(null);
      }
    },
    [kind, maxBytes, onChange],
  );

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void send(file);
  }

  function clear() {
    setLocal(null);
    setError(null);
    onChange("", null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className={cn(
          "flex items-center gap-3 rounded-md border border-dashed border-line bg-surface p-3 transition-colors",
          "data-[dragging]:border-ink data-[dragging]:bg-canvas-deep",
          disabled && "opacity-50",
        )}
      >
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-canvas-deep text-ink-soft"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <FileGlyph type={displayType} name={displayName} className="size-[18px]" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {displayName ? (
            <p className="truncate text-[14px] font-medium tracking-[-0.02em] text-ink" title={displayName}>
              {displayName}
            </p>
          ) : (
            <p className="text-[14px] font-medium tracking-[-0.02em] text-ink">
              Drag a file here, or browse
            </p>
          )}

          <p id={`${id}-caption`} className="mt-0.5 font-mono text-[12px] leading-4 text-ink-muted">
            {busy
              ? `Uploading… ${progress}%`
              : displayName
                ? [extensionOf(displayName, displayType), displaySize ? formatBytes(displaySize) : null]
                    .filter(Boolean)
                    .join(" · ")
                : `PDF, ZIP, EPUB, MP3 or MP4 · up to ${formatBytes(maxBytes)}`}
          </p>
        </div>

        {/* The input sits immediately before its label so `peer-focus-visible`
            can paint a ring on the visible control while the real, keyboard
            reachable <input type="file"> stays in the tab order. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={accept}
            disabled={disabled || busy}
            aria-label={label ? `${label}: choose a file` : "Choose a file"}
            aria-describedby={`${id}-caption`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void send(file);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[14px] font-medium tracking-[-0.02em] text-ink transition-colors",
              "hover:bg-canvas-deep hover:border-line-strong/50",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2",
              (disabled || busy) && "pointer-events-none opacity-50",
            )}
          >
            <Upload className="size-3.5" aria-hidden />
            {url || local ? "Replace" : "Upload"}
          </label>
          {(url || local) && !busy && (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label={`Remove ${displayName || "file"}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {busy && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ?? 0}
          aria-label="Upload progress"
          className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full bg-ink transition-[width] duration-200 ease-out"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      {allowUrl && (
        <div className="mt-2">
          <label htmlFor={urlId} className="sr-only">
            {label ? `${label} URL` : "File URL"}
          </label>
          <input
            id={urlId}
            type="url"
            inputMode="url"
            spellCheck={false}
            disabled={disabled || busy}
            value={url}
            onChange={(e) => {
              setLocal(null);
              setError(null);
              onChange(e.target.value, null);
            }}
            placeholder="or paste a file URL"
            className="field text-[13px]"
          />
        </div>
      )}

      {hint && <p className="mt-1.5 text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}
