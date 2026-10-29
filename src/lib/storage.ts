import "server-only";
import { DOCUMENT_BUCKET, supabaseAdmin } from "./supabase";

/**
 * Document bytes live in a private Supabase Storage bucket in production. Without Supabase
 * (local/offline) they are kept base64-encoded in the documents table instead.
 */

export async function putDocumentBytes(applicationId: string, documentId: string, filename: string, mime: string, bytes: Buffer) {
  const sb = supabaseAdmin();
  if (!sb) return { storage_path: null, data_b64: bytes.toString("base64") };
  const safe = filename.replace(/[^\w.-]+/g, "_").slice(-80);
  const storage_path = `${applicationId}/${documentId}-${safe}`;
  const { error } = await sb.storage.from(DOCUMENT_BUCKET).upload(storage_path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { storage_path, data_b64: null };
}

export async function getDocumentBytes(doc: { storage_path: string | null; data_b64: string | null }): Promise<Buffer> {
  if (doc.data_b64) return Buffer.from(doc.data_b64, "base64");
  const sb = supabaseAdmin();
  if (!sb || !doc.storage_path) throw new Error("Document bytes unavailable");
  const { data, error } = await sb.storage.from(DOCUMENT_BUCKET).download(doc.storage_path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export const storageMode = () => (supabaseAdmin() ? "supabase" : "database");
