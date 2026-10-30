// Tidies the live demo without starting from zero:
//   1. keeps the original history vendors (Apex, Sai Krupa, Deccan, Orion, Vertex, Murugan — the first
//      application of each) and deletes every other application with its documents, runs, emails,
//      audit entries and stored files (test runs of the test-case vendors, so they can be run fresh)
//   2. imports the extra history vendors quietly (checked and decided, but nobody is emailed),
//      skipping any already present
//
//   node --env-file=.env.local scripts/reset-demo.mjs --yes
//
// Needs DATABASE_URL (or DIRECT_URL), SUPABASE_URL, SUPABASE_SECRET_KEY and INTAKE_SHARED_SECRET.
// BASE_URL defaults to the live app.
import { spawnSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const KEEP_SCENARIOS = ["apex", "saikrupa", "deccan", "orion", "vertex", "murugan"];
const ADD_HISTORY = ["kalpataru", "suryodaya", "bharat", "venkateswara", "coastal", "patil", "ganga"];

const BASE = process.env.BASE_URL ?? "https://zamp-prep.vercel.app";
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { prepare: false, max: 1 });

const apps = await sql`select id, scenario, legal_name, status from applications order by created_at`;
const keep = new Set();
for (const s of KEEP_SCENARIOS) {
  const first = apps.find((a) => a.scenario === s);
  if (first) keep.add(first.id);
}
const drop = apps.filter((a) => !keep.has(a.id));
console.log(`${apps.length} applications: keeping ${keep.size}, deleting ${drop.length} (${apps.length ? Math.round((drop.length / apps.length) * 100) : 0}%)`);
for (const a of drop) console.log(`   - ${a.id}  ${a.status.padEnd(16)} ${a.legal_name}`);

if (!process.argv.includes("--yes")) {
  console.log("\nNothing changed. Run again with --yes to apply.");
  await sql.end();
  process.exit(1);
}

const ids = drop.map((a) => a.id);
if (ids.length) {
  const files = await sql`select storage_path from documents where application_id = any(${ids}) and storage_path is not null`;
  // Documents, runs, run events, readings, checks and emails cascade from applications; the audit log does not.
  await sql`delete from audit_log where application_id = any(${ids})`;
  await sql`delete from applications where id = any(${ids})`;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.SUPABASE_URL && key && files.length) {
    const sb = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
    const paths = files.map((f) => f.storage_path);
    for (let i = 0; i < paths.length; i += 100) await sb.storage.from("vendor-documents").remove(paths.slice(i, i + 100));
    console.log(`Removed ${paths.length} stored file(s).`);
  }
}

const present = new Set((await sql`select scenario from applications where scenario is not null`).map((r) => r.scenario));
await sql.end();
const toAdd = ADD_HISTORY.filter((s) => !present.has(s));
if (toAdd.length) {
  console.log(`\nImporting ${toAdd.length} history vendor(s) into ${BASE} (no emails)…`);
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, "submit-scenarios.mjs"), "--quiet", ...toAdd], {
    stdio: "inherit", env: { ...process.env, BASE_URL: BASE },
  });
  if (r.status !== 0) console.log("Import finished with errors (see above).");
}
console.log("\nDone.");
