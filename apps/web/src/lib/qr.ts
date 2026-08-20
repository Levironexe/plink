/**
 * QR codes for a creator's public page.
 *
 * A thin, validated wrapper around the `qrcode` package: callers hand us a URL
 * and a requested pixel size, and we clamp everything to a sane range before it
 * reaches the renderer — an unbounded `size` is an easy way to burn a server.
 */

import { toBuffer, toString as renderQr } from "qrcode";

export const QR_MIN_SIZE = 128;
export const QR_MAX_SIZE = 1024;
export const QR_DEFAULT_SIZE = 512;
/** The sizes offered in the dashboard. */
export const QR_SIZES = [256, 512, 1024] as const;

export const QR_DARK = "#171717";
export const QR_LIGHT = "#ffffff";

export type QrOptions = {
  /** Pixel width of the square render. Clamped to 128–1024. */
  size?: number | string | null;
  /** Hex colour of the modules. Falls back to ink. */
  dark?: string | null;
  /** Hex colour of the quiet zone. Falls back to white. */
  light?: string | null;
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Coerce anything a query string can carry into a size we are happy to render. */
export function clampQrSize(input: number | string | null | undefined): number {
  const value = typeof input === "string" ? Number.parseInt(input, 10) : input;
  if (typeof value !== "number" || !Number.isFinite(value)) return QR_DEFAULT_SIZE;
  return Math.min(QR_MAX_SIZE, Math.max(QR_MIN_SIZE, Math.round(value)));
}

function colour(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const clean = value.trim();
  return HEX.test(clean) ? clean : fallback;
}

function renderOptions(options: QrOptions) {
  return {
    width: clampQrSize(options.size),
    margin: 2,
    errorCorrectionLevel: "M" as const,
    color: {
      dark: colour(options.dark, QR_DARK),
      light: colour(options.light, QR_LIGHT),
    },
  };
}

function requireUrl(url: string): string {
  const clean = url.trim();
  if (!clean) throw new Error("A URL is required to render a QR code");
  return clean;
}

/** PNG bytes, ready to stream from a route handler. */
export async function qrPngBuffer(url: string, options: QrOptions = {}): Promise<Buffer> {
  return toBuffer(requireUrl(url), { type: "png", ...renderOptions(options) });
}

/** An SVG document — crisp at any size and tiny enough to inline. */
export async function qrSvgString(url: string, options: QrOptions = {}): Promise<string> {
  return renderQr(requireUrl(url), { type: "svg", ...renderOptions(options) });
}
