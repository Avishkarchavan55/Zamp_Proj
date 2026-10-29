// One-off Supabase setup: creates the private storage bucket for vendor documents.
// Tables are created automatically by the app on first request.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_BUCKET ?? "vendor-documents";
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: existing } = await sb.storage.getBucket(bucket);
if (existing) {
  console.log(`Bucket "${bucket}" already exists (public: ${existing.public})`);
} else {
  const { error } = await sb.storage.createBucket(bucket, { public: false, fileSizeLimit: 8 * 1024 * 1024 });
  if (error) throw error;
  console.log(`Created private bucket "${bucket}"`);
}
