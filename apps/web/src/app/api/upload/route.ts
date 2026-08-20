import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  UPLOAD_NOT_CONFIGURED_MESSAGE,
  deleteObject,
  objectKey,
  ownsObject,
  pathnameFromUrl,
  putObject,
  uploadEnabled,
  uploadKindSchema,
  validateUpload,
} from "@plink/storage";

/** Blob bodies stream through a Node function; Vercel accepts up to 100 MB. */
export const runtime = "nodejs";
export const maxDuration = 60;

const deleteSchema = z
  .object({
    url: z.string().min(1).optional(),
    pathname: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.url ?? v.pathname), { message: "Nothing to delete" });

export async function POST(req: NextRequest) {
  const ipLimit = rateLimit(clientKey(req, "upload"), 60, 10 * 60_000);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

  const userId = await getSessionUserId();
  if (!userId) return fail("Sign in to upload files", 401);

  // Two windows: one per IP to blunt bursts before we touch the session, one
  // per account so a single signed-in creator cannot run up the storage bill.
  const userLimit = rateLimit(`upload:user:${userId}`, 40, 10 * 60_000);
  if (!userLimit.ok) return tooMany(userLimit.retryAfter);

  if (!uploadEnabled()) return fail(UPLOAD_NOT_CONFIGURED_MESSAGE, 503);

  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data")) {
    return fail("Send the file as multipart/form-data", 415);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("That upload was malformed. Try again.", 400);
  }

  const kind = uploadKindSchema.safeParse(form.get("kind"));
  if (!kind.success) return fail("Unknown upload kind", 422);

  const entry = form.get("file");
  if (!entry || typeof entry === "string") return fail("Choose a file to upload", 422);

  const check = validateUpload(kind.data, { type: entry.type, size: entry.size });
  if (!check.ok) return fail(check.message, 422);

  const pathname = objectKey(userId, kind.data, entry.name || "upload");

  try {
    const blob = await putObject({ pathname, body: entry, contentType: check.contentType });
    return ok({
      url: blob.url,
      pathname: blob.pathname,
      size: entry.size,
      contentType: blob.contentType,
      downloadUrl: blob.downloadUrl,
      name: entry.name || "",
    });
  } catch (err) {
    // Message only — a Blob SDK error never carries the token, and we never widen that.
    console.error("[upload] put failed:", err instanceof Error ? err.message : "unknown error");
    return fail("The upload didn't go through. Please try again.", 502);
  }
}

export async function DELETE(req: NextRequest) {
  const ipLimit = rateLimit(clientKey(req, "upload-delete"), 60, 10 * 60_000);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

  const userId = await getSessionUserId();
  if (!userId) return fail("Sign in to manage your uploads", 401);

  if (!uploadEnabled()) return fail(UPLOAD_NOT_CONFIGURED_MESSAGE, 503);

  const parsed = deleteSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Tell us which file to delete", 422);

  const target = parsed.data.url ?? parsed.data.pathname ?? "";
  const pathname = pathnameFromUrl(target);
  if (!pathname) return fail("That file reference isn't valid", 422);

  // Ownership is derived from the key itself: every object this app writes is
  // namespaced under `u/<userId>/`, so a key outside the caller's prefix is
  // either someone else's file or forged. Either way it is not theirs to delete.
  if (!ownsObject(userId, pathname)) return fail("That file isn't yours to delete", 403);

  try {
    await deleteObject(pathname);
  } catch (err) {
    console.error("[upload] delete failed:", err instanceof Error ? err.message : "unknown error");
    return fail("Couldn't remove that file. Please try again.", 502);
  }

  return ok({ ok: true, pathname });
}
