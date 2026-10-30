"use client";

import { BookOpenCheck, Brain, Building, Cable, Calculator, FileCheck2, Landmark, Lock, Scale, Sparkles } from "lucide-react";
import useSWR from "swr";
import { Badge, Card, CardHeader, PageHeader, cx } from "@/components/ui";
import { ENTITY_LABELS } from "@/lib/india";
import { DECISION_RULES, DOC_SLOTS, MANUAL_MINUTES, PAYMENT_TERMS, POLICY_PRINCIPLES, REQUIRED_DOCS, THRESHOLDS } from "@/lib/policy";
import type { EntityType } from "@/lib/types";

interface System {
  extractor: string;
  ai_chain: { id: string; label: string; configured: boolean }[];
  n8n: boolean;
  smtp: boolean;
  database: string;
  storage: string;
  realtime: boolean;
  turnstile: boolean;
}

const OUTCOME_TONE = { rejected: "critical", awaiting_vendor: "warn", in_review: "serious", approved: "good" } as const;
const OUTCOME_LABEL = { rejected: "Rejected", awaiting_vendor: "Awaiting vendor", in_review: "Needs review", approved: "Approved" };

const CHECKS = [
  { icon: FileCheck2, title: "Document AI", who: "AI", items: ["Classifies every upload — catches the wrong document in the wrong slot, and sorts email attachments", "Extracts fields with a verbatim quote, confidence and location on the page", "IDs read from digital PDFs must literally appear in the PDF's text layer", "Low-confidence key fields get a second model's opinion; disagreement → human"] },
  { icon: Calculator, title: "Identifier rules", who: "Code", items: ["PAN structure, holder type (4th character) and name initial (5th character)", "GSTIN structure and mod-36 checksum — typos caught, correct value suggested from the certificate", "IFSC, CIN (type and year), Udyam number, phone formats"] },
  { icon: Scale, title: "Cross-reference", who: "Code", items: ["GSTIN must embed the vendor's own PAN; its state code must match the address", "Every identifier on the form compared character-for-character with the documents", "Names normalised (Pvt. Ltd. = Private Limited) — near-matches go to review", "GST registration cannot pre-date incorporation; Udyam category must match the certificate"] },
  { icon: Landmark, title: "External sources", who: "APIs", items: ["IFSC resolved live in the national bank directory; the cheque's bank must own it", "PIN code resolved live in India Post's directory; must lie in the stated state", "GST registration Active and in the vendor's name (internal registry dataset)", "Bank ownership stays Unverified until a penny-drop connector is added"] },
  { icon: Building, title: "Risk & duplicates", who: "Code", items: ["Bank account registered to another legal entity → disqualifying", "Same PAN/GSTIN as an approved vendor → review (duplicate or change request)", "Bank/ID documents produced in image-editing software → review", "Emailed applications must pass SPF/DKIM sender authentication"] },
];

export default function PolicyPage() {
  const { data: sys } = useSWR<System>("/api/system");
  return (
    <div className="space-y-6">
      <PageHeader title="How decisions are made" subtitle="The exact rules the system follows — the same ones shown in every decision." />

      <Card>
        <CardHeader title="Principles" icon={BookOpenCheck} />
        <ul className="grid gap-3 p-5 md:grid-cols-2">
          {POLICY_PRINCIPLES.map((p, i) => (
            <li key={p} className="flex gap-3 text-[13px] text-ink-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand-2">{i + 1}</span>
              <span className="pt-0.5">{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Decision rules" subtitle="Evaluated top to bottom — the first rule with a matching check decides" icon={Scale} />
        <ol className="divide-y divide-line-2">
          {DECISION_RULES.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
              <span className="font-mono text-[13px] font-semibold text-ink-3">{r.id}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">{r.title}<Badge tone={OUTCOME_TONE[r.outcome]}>{OUTCOME_LABEL[r.outcome]}</Badge></div>
                <p className="mt-1 text-[13px] text-ink-2">{r.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Document-reading fallback chain" subtitle="Tried in order per document. If all fail, the document goes to a person — nothing is guessed." icon={Sparkles} />
        <ol className="flex flex-wrap items-center gap-2 px-5 py-4">
          {(sys?.ai_chain ?? []).map((p, i, arr) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className={cx("rounded-lg border px-3 py-2 text-[12.5px]", p.configured ? "border-good/40 bg-good-soft text-good-ink" : "border-line bg-line-2 text-ink-3")}>
                <span className="font-medium">{p.label}</span>
                <span className="ml-1.5 text-[11px]">{p.configured ? "active" : "not configured"}</span>
              </span>
              <span className="text-ink-3">→</span>
              {i === arr.length - 1 && <span className="rounded-lg border border-serious/40 bg-serious-soft px-3 py-2 text-[12.5px] font-medium text-serious-ink">Human review</span>}
            </li>
          ))}
        </ol>
        <p className="px-5 pb-4 text-[12.5px] text-ink-3">Rate-limited providers are skipped for 90 seconds (circuit breaker). Identical files are never read twice (SHA-256 cache). Every document records which provider read it.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CHECKS.map((c) => (
          <Card key={c.title} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><c.icon className="h-4 w-4 text-ink-3" />{c.title}</div>
              <Badge tone={c.who === "AI" ? "brand" : c.who === "APIs" ? "info" : "neutral"}>{c.who === "AI" ? <Brain className="h-3 w-3" /> : null}{c.who}</Badge>
            </div>
            <ul className="mt-3 space-y-1.5">
              {c.items.map((i) => <li key={i} className="flex gap-2 text-[12.5px] text-ink-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />{i}</li>)}
            </ul>
          </Card>
        ))}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><Calculator className="h-4 w-4 text-ink-3" />Thresholds & terms</div>
          <dl className="mt-3 space-y-2 text-[12.5px]">
            <Row k="Field confidence (else human)" v={`${THRESHOLDS.fieldConfidence * 100}%`} />
            <Row k="Document-type confidence" v={`${THRESHOLDS.typeConfidence * 100}%`} />
            <Row k="New-entity flag" v={`< ${THRESHOLDS.newEntityDays} days`} />
            <Row k="MSME (micro/small) payment terms" v={`≤ ${PAYMENT_TERMS.msmeMaxDays} days`} />
            <Row k="Standard payment terms" v={`${PAYMENT_TERMS.standardDays} days`} />
          </dl>
          <div className="mt-4 border-t border-line pt-3 text-[11.5px] text-ink-3">
            Time-saved metric assumes {MANUAL_MINUTES.reviewPerApplication} min of manual review per application, {MANUAL_MINUTES.perVendorEmail} min per vendor email, and still counts {MANUAL_MINUTES.perReviewCase} min of human time for each case that needs review.
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Required documents by entity type" icon={FileCheck2} />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line"><th className="px-5 py-2 font-medium">Entity</th>{(["incorporation", "gst", "pan", "bank_proof", "udyam"] as const).map((s) => <th key={s} className="px-2 py-2 font-medium">{DOC_SLOTS[s].label.replace(" Certificate", "").replace("Registration", "Reg.").replace(" (MSME)", "")}</th>)}</tr>
              </thead>
              <tbody>
                {(Object.keys(REQUIRED_DOCS) as EntityType[]).map((e) => (
                  <tr key={e} className="border-b border-line-2 last:border-0">
                    <td className="px-5 py-2 text-ink">{ENTITY_LABELS[e]}</td>
                    {(["incorporation", "gst", "pan", "bank_proof"] as const).map((s) => <td key={s} className="px-2 py-2">{REQUIRED_DOCS[e].includes(s) ? <span className="text-good-ink">●</span> : <span className="text-ink-3">—</span>}</td>)}
                    <td className="px-2 py-2 text-[11px] text-ink-3">if MSME</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Integrations" icon={Cable} />
          <dl className="divide-y divide-line-2 text-[13px]">
            {[
              ["Document AI", sys ? (sys.extractor === "fixture" ? "Fixture extractor (test mode)" : `${sys.ai_chain.filter((p) => p.configured).length} providers in the chain`) : "…", sys?.extractor === "chain"],
              ["Vendor email", sys?.n8n ? `n8n → Gmail${sys.smtp ? " · SMTP backup" : ""}` : sys?.smtp ? "SMTP only (n8n off)" : "Not configured", !!(sys?.n8n || sys?.smtp)],
              ["Email & Google Form intake", "n8n Gmail trigger · Apps Script", true],
              ["Bank directory", "Razorpay IFSC API (live)", true],
              ["PIN code directory", "India Post API (live)", true],
              ["GST registry", "Internal dataset — production: live GSP API", false],
              ["Bank account ownership", "Not connected — production: penny-drop API", false],
              ["Data", sys ? `${sys.database === "postgres" ? "Supabase Postgres" : "Embedded Postgres (local)"} · files in ${sys.storage === "supabase" ? "Supabase Storage" : "database"}` : "…", true],
              ["Live run updates", sys?.realtime ? "Supabase Realtime" : "Polling", true],
              ["Bot protection (portal)", sys?.turnstile ? "Cloudflare Turnstile" : "Not configured", !!sys?.turnstile],
            ].map(([k, v, ok]) => (
              <div key={String(k)} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <dt className="text-ink-2">{k}</dt>
                <dd className="flex items-center gap-2 text-right text-ink"><span className={ok ? "h-1.5 w-1.5 rounded-full bg-good" : "h-1.5 w-1.5 rounded-full bg-warn"} />{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Access & privacy" icon={Lock} />
        <ul className="grid gap-2 p-5 text-[12.5px] text-ink-2 md:grid-cols-2">
          <li>• Staff sign in; every decision is recorded under the signed-in person.</li>
          <li>• Only a Finance Controller can reverse a rejection (segregation of duties).</li>
          <li>• Account numbers are masked by default in the console.</li>
          <li>• Aadhaar is never collected; only data needed for verification is kept (DPDP Act).</li>
          <li>• Documents are stored privately and served only through the signed-in console.</li>
          <li>• Vendors only ever see their own requests — never internal checks or scores.</li>
        </ul>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-ink-2">{k}</dt><dd className="font-mono">{v}</dd></div>;
}
