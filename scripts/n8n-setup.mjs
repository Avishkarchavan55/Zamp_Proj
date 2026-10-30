// Sets up n8n for VendorIQ through the n8n public API:
//   1. creates SMTP + IMAP credentials for the onboarding Gmail (App Password — no Google OAuth)
//   2. imports W1 (vendor communications & reminders) and W2 (inbound vendor email) with real values
//   3. activates both and prints the webhook URL to put in N8N_WEBHOOK_URL
//
//   N8N_URL=https://<your-n8n> N8N_API_KEY=... SMTP_USER=... SMTP_PASS=... N8N_SHARED_SECRET=... APP_URL=https://<app> \
//     node scripts/n8n-setup.mjs
// Re-running updates the workflows in place (matched by name) and creates fresh credentials.
import fs from "node:fs";
import path from "node:path";

const need = ["N8N_URL", "N8N_API_KEY", "SMTP_USER", "SMTP_PASS", "N8N_SHARED_SECRET", "APP_URL"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing:", missing.join(", "));
  process.exit(1);
}
const N8N = process.env.N8N_URL.replace(/\/$/, "");
const APP = process.env.APP_URL.replace(/\/$/, "");
const sender = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS.replace(/\s/g, "");

async function api(method, p, body) {
  const res = await fetch(`${N8N}/api/v1${p}`, {
    method,
    headers: { "X-N8N-API-KEY": process.env.N8N_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const smtp = await api("POST", "/credentials", {
  name: "VendorIQ Gmail SMTP",
  type: "smtp",
  data: { user: sender, password: pass, host: "smtp.gmail.com", port: 465, secure: true, disableStartTls: false },
});
const imap = await api("POST", "/credentials", {
  name: "VendorIQ Gmail IMAP",
  type: "imap",
  data: { user: sender, password: pass, host: "imap.gmail.com", port: 993, secure: true, allowUnauthorizedCerts: false },
});
console.log("credentials:", smtp.id, imap.id);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const existing = (await api("GET", "/workflows?limit=100")).data ?? [];

for (const file of ["vendoriq-communications.json", "vendoriq-email-intake.json"]) {
  let raw = fs.readFileSync(path.join(root, "n8n", file), "utf8");
  raw = raw
    .replaceAll("REPLACE_WITH_SHARED_SECRET", process.env.N8N_SHARED_SECRET)
    .replaceAll("REPLACE_WITH_APP_URL", APP)
    .replaceAll("__SMTP_ID__", smtp.id)
    .replaceAll("__IMAP_ID__", imap.id)
    .replaceAll("{{ $env.SMTP_FROM_ADDRESS || 'REPLACE_WITH_SENDER' }}", sender)
    .replaceAll("($env.SMTP_FROM_ADDRESS || '')", JSON.stringify(sender));
  const wf = JSON.parse(raw);
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: "v1" } };
  const found = existing.find((w) => w.name === wf.name);
  const saved = found ? await api("PUT", `/workflows/${found.id}`, body) : await api("POST", "/workflows", body);
  await api("POST", `/workflows/${saved.id}/activate`);
  console.log(`${found ? "updated" : "imported"} + activated: ${wf.name} (${saved.id})`);
}
console.log(`\nN8N_WEBHOOK_URL=${N8N}/webhook/vendoriq-comms`);
