// Resets the live demo to a clean, realistic state:
//   1. deletes every application, document, run, email record and stored file (VendorIQ tables only —
//      n8n's data and all settings are untouched); the app recreates empty tables on its next request
//   2. imports the history vendors quietly (checked and decided, but nobody is emailed):
//      Apex, Sai Krupa, Deccan, Murugan (approved), Orion (rejected), Vertex (waiting for a GSTIN fix)
//
//   node --env-file=.env.local scripts/reset-demo.mjs --yes
//
// Needs DATABASE_URL (or DIRECT_URL), SUPABASE_URL, SUPABASE_SECRET_KEY and INTAKE_SHARED_SECRET.
// BASE_URL defaults to the live app.
import { spawnSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--yes")) {
  console.log("This deletes ALL VendorIQ applications on the database in DATABASE_URL and reloads the demo history.");
  console.log("Run again with --yes to continue.");
  process.exit(1);
}
const BASE = process.env.BASE_URL ?? "https://zamp-prep.vercel.app";
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

console.log("1/3  Clearing VendorIQ tables…");
const sql = postgres(url, { prepare: false, max: 1 });
await sql.unsafe(`drop table if exists run_events, checks, extractions, communications, audit_log, documents, runs, applications, gst_registry, app_users cascade;
                  drop sequence if exists application_seq;`);
await sql.end();

console.log("2/3  Clearing stored documents…");
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.SUPABASE_URL && key) {
  const sb = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
  const { data: folders } = await sb.storage.from("vendor-documents").list("", { limit: 1000 });
  let removed = 0;
  for (const f of folders ?? []) {
    const { data: inner } = await sb.storage.from("vendor-documents").list(f.name, { limit: 1000 });
    const paths = (inner ?? []).map((i) => `${f.name}/${i.name}`);
    if (paths.length) {
      await sb.storage.from("vendor-documents").remove(paths);
      removed += paths.length;
    }
  }
  console.log(`     removed ${removed} file(s)`);
}

console.log(`3/3  Importing history vendors into ${BASE} (no emails)…`);
// The first request recreates the empty tables.
await fetch(`${BASE}/api/health`).catch(() => {});
const r = spawnSync(process.execPath, [path.join(import.meta.dirname, "submit-scenarios.mjs"), "--quiet", "apex", "saikrupa", "deccan", "orion", "vertex", "murugan"], {
  stdio: "inherit", env: { ...process.env, BASE_URL: BASE },
});
console.log(r.status === 0 ? "\nDone — the live demo is clean." : "\nImport finished with errors (see above).");
