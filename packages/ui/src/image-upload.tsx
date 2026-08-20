"use client";

import * as React from "react";
import { Image as ImageIcon, LoaderCircle, Upload, X } from "lucide-react";
import { cn } from "@plink/core/utils";
import type { UploadKind } from "@plink/storage";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, formatBytes, uploadToStore } from "./file-upload";

const GENERIC_ERROR = "The upload didn't go through. Please try again.";

export type ImageUploadShape = "circle" | "square" | "wide";

const shapes: Record<ImageUploadShape, string> = {
  circle: "size-16 rounded-full",
  square: "size-16 rounded-md",
  wide: "h-16 w-28 rounded-md",
};

export type ImageUploadProps = {
  /** Current image URL, or "" when there is none. */
  value?: string | null;
  /** Fires with the new URL — "" when the image is removed. */
  onChange: (url: string) => void;
  /** Namespaces the stored object under the signed-in user. */
  kind: UploadKind;
  label?: string;
  hint?: string;
  /** Preview frame. Defaults to "square". */
  shape?: ImageUploadShape;
  /** Alt text for the preview. Defaults to "". */
  alt?: string;
  /** Client-side size hint in bytes. The server still enforces its own cap. */
  maxBytes?: number;
  /** Show the "or paste an image URL" fallback. Defaults to true. */
  allowUrl?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/**
 * Drag-and-drop or click-to-browse image upload with a local preview and real
 * progress. The pasted-URL field below it is a first-class fallback, not a
 * consolation prize: with no Blob store configured the component still works
 * exactly like the plain URL input it replaces.
 */
export function ImageUpload({
  value,
  onChange,
  kind,
  label,
  hint,
  shape = "square",
  alt = "",
  maxBytes = MAX_IMAGE_BYTES,
  allowUrl = true,
  disabled,
  className,
  id: providedId,
}: ImageUploadProps) {
  const reactId = React.useId();
  const id = providedId ?? reactId;
  const inputId = `${id}-file`;
  const urlId = `${id}-url`;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  // Object URLs are revoked on replace and on unmount so previews never leak.
  const objectUrlRef = React.useRef<string | null>(null);
  const releasePreview = React.useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setObjectUrl(null);
  }, []);
  React.useEffect(() => releasePreview, [releasePreview]);

  const busy = progress !== null;
  const url = value ?? "";
  const preview = objectUrl ?? url;

  const send = React.useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("That isn't an image. Use PNG, JPG, WEBP, GIF or AVIF.");
        return;
      }
      if (file.size > maxBytes) {
        setError(`That image is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.`);
        return;
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const next = URL.createObjectURL(file);
      objectUrlRef.current = next;
      setObjectUrl(next);
      setProgress(0);

      try {
        const result = await uploadToStore(file, kind, { onProgress: setProgress });
        onChange(result.url);
        releasePreview();
      } catch (err) {
        releasePreview();
        setError(err instanceof Error ? err.message : GENERIC_ERROR);
      } finally {
        setProgress(null);
      }
    },
    [kind, maxBytes, onChange, releasePreview],
  );

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void send(file);
  }

  function clear() {
    releasePreview();
    setError(null);
    onChange("");
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
          "flex items-center gap-4 rounded-md border border-dashed border-line bg-surface p-3 transition-colors",
          "data-[dragging]:border-ink data-[dragging]:bg-canvas-deep",
          disabled && "opacity-50",
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          aria-label={preview ? `Replace ${label ?? "image"}` : `Upload ${label ?? "image"}`}
          className={cn(
            "relative shrink-0 overflow-hidden border border-line bg-canvas-deep",
            shapes[shape],
          )}
        >
          {preview ? (
            // Creator-supplied and blob: URLs are rendered directly — no proxying.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={alt} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-ink-muted">
              <ImageIcon className="size-[18px]" aria-hidden />
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-surface/70">
              <LoaderCircle className="size-4 animate-spin text-ink" aria-hidden />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          {/* The input sits immediately before its label so `peer-focus-visible`
              can paint a ring on the visible control while the real, keyboard
              reachable <input type="file"> stays in the tab order. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={IMAGE_ACCEPT}
              disabled={disabled || busy}
              aria-label={label ? `${label}: choose an image` : "Choose an image"}
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
              {preview ? "Replace" : "Upload"}
            </label>
            {preview && !busy && (
              <button
                type="button"
                onClick={clear}
                disabled={disabled}
                aria-label={`Remove ${label ?? "image"}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[14px] font-medium tracking-[-0.02em] text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
                Remove
              </button>
            )}
          </div>

          <p id={`${id}-caption`} className="mt-1.5 font-mono text-[12px] leading-4 text-ink-muted">
            {busy
              ? `Uploading… ${progress}%`
              : `Drop an image or browse · PNG, JPG, WEBP, GIF, AVIF · up to ${formatBytes(maxBytes)}`}
          </p>
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
            {label ? `${label} URL` : "Image URL"}
          </label>
          <input
            id={urlId}
            type="url"
            inputMode="url"
            spellCheck={false}
            disabled={disabled || busy}
            value={url}
            onChange={(e) => {
              releasePreview();
              setError(null);
              onChange(e.target.value);
            }}
            placeholder="or paste an image URL"
            className="field text-[13px]"
          />
        </div>
      )}

      {hint && <p className="mt-1.5 text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}
