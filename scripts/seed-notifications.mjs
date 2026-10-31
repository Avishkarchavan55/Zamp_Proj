// Adds sample supplier notifications to applications that have none (imported history vendors are loaded quietly).
// Safe to re-run: applications that already have notifications are skipped.
//
//   node --env-file=.env.local scripts/seed-notifications.mjs          (dry run)
//   node --env-file=.env.local scripts/seed-notifications.mjs --yes    (apply)
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { prepare: false, max: 1 });
const apply = process.argv.includes("--yes");

const apps = await sql`
  select a.id, a.legal_name, a.status, a.created_at, a.updated_at, a.resubmit_token, a.decision->'requested_items' as requested
    from applications a
   where coalesce(a.contact_email, '') <> ''
     and not exists (select 1 from notifications n where n.application_id = a.id)
   order by a.created_at`;

const mins = (d, m) => new Date(new Date(d).getTime() + m * 60_000);
let total = 0;

for (const a of apps) {
  const update = `/vendor/${a.resubmit_token}`;
  const items = (a.requested ?? []).map((i) => i.title);
  const list = items.length ? items.slice(0, 4).join(", ") : "your PAN card and a cancelled cheque";
  const rows = [
    { kind: "received", title: "Application received", body: `We received the registration for ${a.legal_name} and started checking your documents.`, link: "/portal", at: mins(a.created_at, 0) },
  ];
  if (a.status === "approved") {
    rows.push(
      { kind: "in_review", title: "Your application is with our team", body: "Your documents were checked. A member of our team is taking a final look.", link: "/portal", at: mins(a.created_at, 2) },
      { kind: "approved", title: "Your registration is approved", body: `${a.legal_name} is now an approved supplier to Acme Manufacturing.`, link: "/portal", at: mins(a.created_at, 40) },
    );
  } else if (a.status === "awaiting_vendor") {
    rows.push(
      { kind: "action_needed", title: `Action needed: ${Math.max(items.length, 1)} item${items.length === 1 ? "" : "s"}`, body: list, link: update, at: mins(a.created_at, 2) },
      { kind: "reminder", title: "Reminder: action still needed", body: "Your application is on hold until the items we asked for arrive.", link: update, at: mins(a.created_at, 180) },
    );
  } else {
    rows.push({ kind: "in_review", title: "Your application is with our team", body: "A member of our team is reviewing your application. We will contact you if we need anything else.", link: "/portal", at: mins(a.created_at, 2) });
  }
  rows.forEach((r, i) => { r.read = i < rows.length - 1; });
  total += rows.length;
  console.log(`${a.id}  ${a.status.padEnd(15)} ${rows.length} notice(s)  ${a.legal_name}`);
  if (apply) {
    for (const r of rows) {
      await sql`insert into notifications (id, application_id, kind, title, body, link, created_at, read_at)
                values (${"NTF-" + randomUUID().slice(0, 8).toUpperCase()}, ${a.id}, ${r.kind}, ${r.title}, ${r.body}, ${r.link}, ${r.at}, ${r.read ? mins(r.at, 5) : null})`;
    }
  }
}
console.log(apply ? `\nAdded ${total} notification(s) for ${apps.length} application(s).` : `\nDry run: would add ${total} notification(s) for ${apps.length} application(s). Add --yes to apply.`);
await sql.end();
