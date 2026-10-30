// Submits demo scenarios through the public API exactly as the portal does, waits for each run,
// and prints the outcome. Used to test the pipeline and to build real run history for the dashboard.
//
//   node scripts/submit-scenarios.mjs                       # history scenarios (apex first)
//   node scripts/submit-scenarios.mjs shreeji northstar     # specific scenarios
//   BASE_URL=https://your-app.vercel.app node scripts/submit-scenarios.mjs
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const scenarios = JSON.parse(fs.readFileSync(path.join(root, "public/demo/scenarios.json"), "utf8"));

// --quiet: import as history (checked and decided, but no emails). The default history set is always quiet.
const quiet = process.argv.includes("--quiet");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const list = wanted.length
  ? wanted.map((id) => scenarios.find((s) => s.id === id) ?? (console.error(`unknown scenario ${id}`), process.exit(1)))
  : ["apex", "saikrupa", "deccan", "orion", "vertex", "murugan"].map((id) => scenarios.find((s) => s.id === id));

// The console API needs a staff session; the portal submission is public (Turnstile is bypassed with
// the intake secret when INTAKE_SHARED_SECRET is set).
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: "reviewer" }),
});
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
const staff = { cookie };
const intake = process.env.INTAKE_SHARED_SECRET ? { "x-vendoriq-secret": process.env.INTAKE_SHARED_SECRET } : {};

const mime = (f) => (f.endsWith(".pdf") ? "application/pdf" : f.endsWith(".png") ? "image/png" : "image/jpeg");

async function waitForRun(runId) {
  for (let i = 0; i < 180; i++) {
    const r = await fetch(`${BASE}/api/runs/${runId}`, { headers: staff }).then((r) => r.json());
    if (r.run.status !== "running") return r;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("run timed out");
}

for (const s of list) {
  const fd = new FormData();
  fd.set("form", JSON.stringify(s.form));
  fd.set("scenario", s.id);
  if (quiet || !wanted.length) fd.set("quiet", "true");
  for (const [slot, file] of Object.entries(s.files)) {
    const buf = fs.readFileSync(path.join(root, "public/demo", s.id, file));
    fd.set(slot, new Blob([buf], { type: mime(file) }), path.basename(file));
  }
  const res = await fetch(`${BASE}/api/applications`, { method: "POST", body: fd, headers: intake });
  const body = await res.json();
  if (!res.ok) {
    console.error(s.id, "→", res.status, body);
    continue;
  }
  const detail = await waitForRun(body.runId);
  const d = detail.run.decision;
  console.log(`\n■ ${s.id.padEnd(10)} ${body.id}  ${detail.run.status}  → ${detail.run.outcome ?? detail.run.error}  (${detail.run.duration_ms}ms)`);
  if (d) console.log(`  ${d.headline}`);
  for (const c of detail.checks.filter((c) => c.status !== "passed" && c.status !== "skipped"))
    console.log(`   [${c.status}/${c.route}] ${c.code}: ${c.message}`);
}
