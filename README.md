# VendorIQ — vendor onboarding, from submission to decision

A procurement team receives vendor registrations — through a portal, by email, or via a Google Form.
VendorIQ reads the documents, checks them against what the vendor declared, against each other and
against live public directories, and decides **Approved / Awaiting vendor / Needs review / Rejected**
with every reason visible. Anything the vendor must fix is requested automatically and chased by n8n.

**Design rule: the AI reads documents; code decides.** Identifiers are compared by code, decisions come
from four ordered policy rules, and anything that could not be verified is shown as *Unverified* —
never as *Passed*.

```
 Supplier portal (Turnstile) ─┐
 Google Form ─► Apps Script ──┼─► intake ─► 8-stage pipeline ──────────────────────────► decision ─► email
 Email ─► n8n Gmail trigger ──┘   normaliser   Intake · Document AI · Identifier rules ·      R1–R4     (n8n → Gmail,
                                               Cross-reference · External · Risk                       SMTP backup)
 Supabase: Postgres + Storage + Realtime            ▲ Gemini → Flash-Lite → OpenRouter → Workers AI → PDF-text regex → human
```

## What it checks

| Stage | Examples |
|---|---|
| Document AI | Classifies each file (wrong document in a slot), extracts fields with quote, confidence and page location; IDs confirmed against the PDF text layer; second model on low confidence |
| Identifier rules | PAN structure, holder type (4th char) and initial (5th char); GSTIN mod-36 checksum with suggested fix; IFSC, CIN, Udyam formats |
| Cross-reference | GSTIN embeds the vendor's PAN; GSTIN state = address state; form vs every document; names normalised; GST after incorporation; MSME category vs Udyam certificate |
| External (live, free) | IFSC → bank & branch (Razorpay); PIN code → state (India Post); GST registry (sandbox); bank ownership = Unverified |
| Risk | Bank account already used by another entity; duplicate vendor; documents saved in image editors; email SPF/DKIM |

## Edge cases (demo scenarios)

| # | Scenario | Outcome |
|---|---|---|
| — | Shreeji Precision: clean, MSME Micro | Approved + 45-day MSME terms + bank-confirmation hold |
| E1 | Kaveri: GST certificate uploaded as bank proof | Awaiting vendor → n8n email → resubmit → Approved |
| E2 | Northstar: GSTIN of a sister company ("Supplies" vs "Solutions") | Needs review + AI reviewer brief |
| E3 | Meridian: bank account already registered to Apex | Rejected (no auto email) |
| E4 | Vertex: two digits transposed in the GSTIN | Awaiting vendor with suggested value |
| E5 | Murugan Electricals: proprietorship, phone scans | Approved under proprietorship rules |
| E6 | Bluewave: never replies | Reminders ×2 → escalated "vendor unresponsive" |
| E7 | Lakshmi: cheque says HDFC, IFSC is ICICI; saved in Photoshop | Needs review |
| E8 | Pragati: declares Micro, Udyam says Medium | Needs review (payment terms at stake) |
| ✉ | Sahyadri: emails documents, no cheque; replies with it | Draft → confirm → Approved (`public/demo/email-sahyadri/EMAIL.txt`) |

## Run locally

```bash
npm install
cp .env.example .env.local        # optional: add GEMINI_API_KEY etc.
npm run dev                       # http://localhost:3000 → one-click demo login
node scripts/submit-scenarios.mjs # optional: builds run history (BASE_URL=http://localhost:3000)
```

Without any keys the app runs on an embedded Postgres (`.data/`, delete to reset) in fixture test mode,
labelled in the UI. `EXTRACTOR=chain` with no keys demonstrates the no-AI fallback.

## Deploy (all free tiers)

1. **Supabase** — new project. Copy the *Transaction pooler* URL (`DATABASE_URL`), project URL, anon and
   service-role keys. Run `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/setup-supabase.mjs`
   (creates the private `vendor-documents` bucket). Tables are created on first request.
2. **Gemini / OpenRouter / Cloudflare** — create the API keys listed in `.env.example`; in Cloudflare also
   create a Turnstile site for the portal domain.
3. **Vercel** — import the GitHub repo, add the environment variables, deploy. Set `APP_URL` to the URL.
4. **n8n on Render** — Render → New → Blueprint → `deploy/render-n8n.yaml` (data in Supabase, schema `n8n`).
   Import `n8n/vendoriq-communications.json` (W1, outbound) and `n8n/vendoriq-email-intake.json` (W2, inbound),
   connect Gmail on the Gmail nodes, replace the placeholders, activate. Put W1's production webhook URL in
   `N8N_WEBHOOK_URL`.
5. **Gmail** — the onboarding inbox needs 2-Step Verification and an App Password (`SMTP_USER` / `SMTP_PASS`)
   for the SMTP backup.
6. **Google Form** — follow `google/README.md` (Apps Script creates the form and trigger).
7. **UptimeRobot** — ping `https://<app>/api/health` and `https://<n8n>/healthz` every 5 minutes (keeps
   Render awake, stops Supabase pausing, and sends any email n8n failed to confirm via SMTP).
8. Seed: `BASE_URL=https://<app> INTAKE_SHARED_SECRET=… node scripts/submit-scenarios.mjs`.

Share `https://<app>/api/auth/login?as=reviewer` for one-click access.

## Assumptions

- Buyer is a fictional Indian manufacturer; vendors are Indian entities (PAN / GSTIN / IFSC / CIN / Udyam).
- GST registry status uses a sandbox dataset (production: a GSP API); bank ownership needs a penny-drop
  provider and is carried as a condition before the first payment.
- Rejections are never emailed automatically — a person communicates them.
- Synthetic test documents are generated by `scripts/generate_fixtures.py` and are marked as such.
