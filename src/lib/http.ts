import "server-only";
import type { DocSlot } from "./types";

export const SLOTS: DocSlot[] = ["incorporation", "gst", "pan", "bank_proof", "udyam"];

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/** Public base URL used in emails and n8n callbacks. APP_URL wins (needed behind tunnels/proxies). */
export function appUrl(req: Request) {
  return (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return `${file.name} is empty`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 4 MB`;
  // Some browsers/OSes send no type or a generic one; fall back to the file extension.
  const ext = file.name.toLowerCase().match(/\.(pdf|png|jpe?g|webp)$/)?.[1];
  const byExt = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext ? "image/jpeg" : "";
  const type = file.type && file.type !== "application/octet-stream" ? file.type : byExt;
  if (!ALLOWED_MIME.includes(type)) return `${file.name}: only PDF, PNG, JPG or WEBP files are accepted`;
  return null;
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export function n8nAuthorised(req: Request) {
  const secret = process.env.N8N_SHARED_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-vendoriq-secret") === secret;
}
