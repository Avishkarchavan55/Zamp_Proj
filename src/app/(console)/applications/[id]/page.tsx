"use client";

import {
  Activity, Building2, CheckCircle2, ChevronDown, Database, Download, Eye, EyeOff, FileSearch, FileText,
  Gavel, History, Landmark, Loader2, Mail, MessageSquareWarning, Plus, RotateCw, Send, ShieldX, Sparkles, Trash2,
  TriangleAlert, UserRound, XCircle,
} from "@/components/icons";
import Link from "next/link";
import { BackButton } from "@/components/page-nav";
import { EmailVendor } from "@/components/email-vendor";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import type { ApplicationDetail, AuditRow, CommRow, DocumentRow, ExtractionRow } from "@/components/api-types";
import { useMe } from "@/components/shell";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, CardHeader, Empty, Mono, PageHeader, Skeleton, StatusPill, cx, dateTime, secs } from "@/components/ui";
import { Journey } from "@/components/journey";
import { CheckGroups, DecisionPanel } from "@/components/verification";
import { ENTITY_LABELS } from "@/lib/india";
import { DOC_SLOTS, DOC_TYPE_LABELS } from "@/lib/policy";
import type { Application, DocSlot, DocType } from "@/lib/types";
import { ACTION_LABEL, CHANNEL_LABEL } from "@/lib/ui-meta";

const TABS = [
  { id: "checks", label: "Checks", icon: CheckCircle2 },
  { id: "documents", label: "Documents", icon: FileSearch },
  { id: "details", label: "Vendor details", icon: Building2 },
  { id: "comms", label: "Emails", icon: Mail },
  { id: "timeline", label: "History", icon: History },
] as const;

const mask = (acct?: string | null) => (acct ? `•••• ${acct.slice(-4)}` : "-");

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const { data, mutate } = useSWR<ApplicationDetail>(`/api/applications/${id}`, { refreshInterval: 3000 });
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("checks");
  const router = useRouter();
  const toast = useToast();
  const [rerunning, setRerunning] = useState(false);

  if (!data) return <div className="space-y-4"><Skeleton className="h-20 w-96" /><Skeleton className="h-64" /><Skeleton className="h-96" /></div>;
  const { app, latestRun } = data;
  const processing = app.status === "processing";

  async function rerun() {
    setRerunning(true);
    const res = await fetch(`/api/applications/${id}/rerun`, { method: "POST" });
    const body = await res.json();
    setRerunning(false);
    if (!res.ok) return toast("error", body.error);
    router.push(`/runs/${body.runId}`);
  }

  return (
    <div className="space-y-6">
      <BackButton fallback="/applications" />
      <PageHeader
        eyebrow={<span><Mono>{app.id}</Mono> · {ENTITY_LABELS[app.entity_type]} · {app.city}, {app.state} · {app.category || "-"}</span>}
        title={<span className="flex flex-wrap items-center gap-3">{app.legal_name}<StatusPill status={app.status} size="lg" /></span>}
        subtitle={
          app.flags?.includes("vendor_unresponsive") ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-critical-ink"><TriangleAlert className="h-4 w-4" />The vendor did not respond to reminders - escalated to you.</span>
          ) : app.needs_confirmation ? (
            "Sent by email - details were read from the documents and the vendor must confirm them."
          ) : undefined
        }
        right={
          <>
            {latestRun && <Link href={`/runs/${latestRun.run.id}`}><Button variant={processing ? "primary" : "secondary"}><Activity className="h-4 w-4" />{processing ? "Watch it live" : "See how it was checked"}</Button></Link>}
            <EmailVendor app={app} onSent={() => mutate()} />
            <Button variant="ghost" onClick={rerun} loading={rerunning} disabled={processing} title="Run all checks again"><RotateCw className="h-4 w-4" />Re-check</Button>
          </>
        }
      />

      <Journey status={app.status} source={app.source} audit={data.audit} />

      {processing && latestRun && (
        <Link href={`/runs/${latestRun.run.id}`} className="flex items-center gap-3 rounded-md border border-brand/30 bg-brand-soft px-5 py-4 text-[14px] hover:border-brand">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span className="font-medium text-ink">Checking this vendor right now</span>
          <span className="text-ink-2">- watch it live</span>
        </Link>
      )}

      {!processing && app.decision && <DecisionPanel decision={app.decision} />}
      {!processing && (app.status === "in_review" || app.status === "rejected" || app.status === "awaiting_vendor") && <ReviewPanel app={app} onDone={() => mutate()} />}
      {!processing && app.status === "approved" && <ErpCard id={app.id} />}

      <Card>
        <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-line px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "-mb-px flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-[14px] font-medium transition-colors duration-150",
                tab === t.id ? "border-brand text-brand-2" : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "comms" && data.communications.length > 0 && <span className="rounded-full bg-line-2 px-1.5 text-[12px] text-ink-2">{data.communications.length}</span>}
            </button>
          ))}
        </div>
        {tab === "checks" && (latestRun?.checks.length ? <CheckGroups checks={latestRun.checks} /> : <Empty title="No checks yet" />)}
        {tab === "documents" && <DocumentInspector app={app} documents={data.documents} extractions={latestRun?.extractions ?? []} />}
        {tab === "details" && <Details app={app} />}
        {tab === "comms" && <Communications comms={data.communications} />}
        {tab === "timeline" && <Timeline audit={data.audit} runs={data.runs} />}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// ERP vendor record (S2)
// ------------------------------------------------------------------------------------------------

interface ErpRecord {
  vendor_code: string;
  payment_terms_days: number;
  payment_holds: string[];
  msme: { registered: boolean; category: string | null; section_43b_h_applies: boolean; udyam_number: string | null };
  gstin: string;
  bank: { account_number: string; ifsc: string; bank: string | null; branch: string | null };
}

function ErpCard({ id }: { id: string }) {
  const { data } = useSWR<ErpRecord>(`/api/applications/${id}/erp`);
  const [json, setJson] = useState(false);
  if (!data) return null;
  return (
    <Card>
      <CardHeader
        icon={Database}
        title="ERP vendor master record"
        subtitle="What finance loads into the ERP - the process ends with a usable record, not just an approval"
        right={<a href={`/api/applications/${id}/erp?format=csv`}><Button variant="secondary" size="sm"><Download className="h-4 w-4" />Download CSV</Button></a>}
      />
      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Kv k="Vendor code" v={<Mono>{data.vendor_code}</Mono>} />
        <Kv k="Payment terms" v={<span className="font-semibold">{data.payment_terms_days} days{data.msme.section_43b_h_applies && <span className="ml-1.5 font-normal text-ink-3">MSME · s.43B(h)</span>}</span>} />
        <Kv k="Bank" v={<span>{data.bank.bank} · {mask(data.bank.account_number)}</span>} />
        <Kv k="Payment holds" v={data.payment_holds.length ? data.payment_holds.map((h) => <Badge key={h} tone="warn" className="mr-1">{h.replace(/_/g, " ").toLowerCase()}</Badge>) : <span className="text-good-ink">None</span>} />
      </div>
      <button onClick={() => setJson((j) => !j)} className="flex w-full items-center gap-1.5 px-5 py-2 text-[12px] text-ink-3 hover:text-ink">
        <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", json && "rotate-180")} /> {json ? "Hide" : "Show"} full JSON record
      </button>
      {json && <pre className="scrollbar-thin mx-5 mb-4 max-h-72 overflow-auto rounded-lg bg-[#161616] p-4 font-mono text-[12px] text-slate-200">{JSON.stringify({ ...data, bank: { ...data.bank, account_number: mask(data.bank.account_number) } }, null, 2)}</pre>}
    </Card>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-surface px-5 py-3">
      <div className="text-[12px] font-medium text-ink-3">{k}</div>
      <div className="mt-0.5 text-[13px] text-ink">{v}</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Reviewer actions - identity and permissions come from the signed-in session
// ------------------------------------------------------------------------------------------------

function ReviewPanel({ app, onDone }: { app: Application; onDone: () => void }) {
  const { data: me } = useMe();
  const needsHuman = app.status === "in_review";
  const [open, setOpen] = useState(needsHuman);
  const [mode, setMode] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<{ title: string; instruction: string; slot?: DocSlot }[]>([{ title: "", instruction: "" }]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const lockedRejection = app.status === "rejected" && me && !me.can_override_rejection;

  async function submit() {
    if (!mode) return;
    setBusy(true);
    const res = await fetch(`/api/applications/${app.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: mode, note, items: mode === "request_info" ? items : undefined }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return toast("error", body.error);
    toast("success", mode === "request_info" ? "Clarification sent to the vendor" : `Application ${mode === "approve" ? "approved" : "rejected"}`);
    setMode(null);
    setNote("");
    onDone();
  }

  const aiAsks = app.decision?.ai_brief?.ask_vendor ?? [];
  const templates = [
    ...aiAsks.map((a) => ({ ...a, ai: true })),
    { title: "Confirm bank account ownership", instruction: "Please upload a bank letter on the bank's letterhead confirming the account holder name, account number and IFSC.", ai: false },
    { title: "Explain name difference", instruction: "The company name differs between your documents. Please explain the difference and provide supporting documentation (e.g. name-change certificate).", ai: false },
  ];

  return (
    <Card className={cx(needsHuman && "border-serious/40")}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <Gavel className={cx("h-4 w-4", needsHuman ? "text-serious-ink" : "text-ink-3")} />
          <div>
            <div className="text-[14px] font-semibold text-ink">{needsHuman ? "Make your decision" : "Override or follow up"}</div>
            <div className="text-[13px] text-ink-3">Recorded under your name in the history.</div>
          </div>
        </div>
        <ChevronDown className={cx("h-4 w-4 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4">
          {lockedRejection ? (
            <div className="flex items-start gap-2 rounded-lg bg-line-2 px-3 py-2.5 text-[13px] text-ink-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              This vendor was rejected. Reversing a rejection needs a <span className="font-medium text-ink">Finance Controller</span> (segregation of duties). Sign in as the controller to override.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant={mode === "approve" ? "success" : "secondary"} size="sm" onClick={() => setMode("approve")}><CheckCircle2 className="h-4 w-4" />Approve</Button>
              <Button variant={mode === "request_info" ? "primary" : "secondary"} size="sm" onClick={() => setMode("request_info")}><MessageSquareWarning className="h-4 w-4" />Ask vendor</Button>
              <Button variant={mode === "reject" ? "danger" : "secondary"} size="sm" onClick={() => setMode("reject")}><ShieldX className="h-4 w-4" />Reject</Button>
            </div>
          )}
          {mode && !lockedRejection && (
            <div className="animate-rise mt-4 space-y-3">
              {mode === "request_info" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    Suggestions:
                    {templates.map((t) => (
                      <button key={t.title} onClick={() => setItems((cur) => [...cur.filter((i) => i.title), { title: t.title, instruction: t.instruction }])} className={cx("flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-line-2", t.ai ? "border-brand/40 text-brand-2" : "border-line text-ink-2")}>
                        {t.ai && <Sparkles className="h-3 w-3" />}{t.title}
                      </button>
                    ))}
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_2fr_auto]">
                      <input placeholder="What do you need?" value={it.title} onChange={(e) => setItems((c) => c.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="input" />
                      <input placeholder="Instruction for the vendor" value={it.instruction} onChange={(e) => setItems((c) => c.map((x, j) => (j === i ? { ...x, instruction: e.target.value } : x)))} className="input" />
                      <button aria-label="Remove item" onClick={() => setItems((c) => c.filter((_, j) => j !== i))} className="rounded-lg p-2 text-ink-3 hover:bg-line-2"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setItems((c) => [...c, { title: "", instruction: "" }])} className="flex items-center gap-1 text-[12px] font-medium text-brand-2"><Plus className="h-3.5 w-3.5" />Add item</button>
                </div>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={mode === "approve" ? "Why is this safe to approve? (e.g. verified with vendor by phone; sister company invoices on their behalf under contract #…)" : mode === "reject" ? "Reason for rejection" : "Internal note for the audit trail"}
                className="input w-full"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-3">Recorded as <span className="font-medium text-ink-2">{me?.name} ({me?.role_label})</span></span>
                <Button onClick={submit} loading={busy} variant={mode === "reject" ? "danger" : mode === "approve" ? "success" : "primary"}>
                  {mode === "request_info" ? <><Send className="h-4 w-4" />Send to vendor</> : mode === "approve" ? "Confirm approval" : "Confirm rejection"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// Documents & evidence
// ------------------------------------------------------------------------------------------------

const FORM_FOR_FIELD: Record<string, keyof Application> = {
  legal_name: "legal_name", trade_name: "trade_name", pan: "pan", gstin: "gstin", cin: "cin", state: "state",
  account_holder_name: "bank_account_holder", account_number: "bank_account_number", ifsc: "bank_ifsc", bank_name: "bank_name",
  udyam_number: "udyam_number", msme_category: "msme_category",
};

const norm = (s: string) =>
  s.toUpperCase().replace(/&/g, "AND").replace(/\bPVT\b/g, "PRIVATE").replace(/\bLTD\b/g, "LIMITED").replace(/[^A-Z0-9]/g, "");

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini (primary)", "gemini-lite": "Gemini (backup)", openrouter: "OpenRouter", "workers-ai": "Workers AI",
  "pdf-text-regex": "PDF text (no AI)", fixture: "Fixture (test)", none: "Not read",
};

function DocumentInspector({ app, documents, extractions }: { app: Application; documents: DocumentRow[]; extractions: ExtractionRow[] }) {
  const current = documents.filter((d) => !d.superseded);
  const [sel, setSel] = useState<string | null>(current[0]?.id ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const doc = documents.find((d) => d.id === sel);
  const ex = extractions.find((e) => e.document_id === sel);
  if (!documents.length) return <Empty icon={FileText} title="No documents uploaded" />;
  const boxes = ex?.fields.filter((f) => Array.isArray(f.box_2d) && f.box_2d.length === 4) ?? [];
  return (
    <div className="grid lg:grid-cols-[230px_1fr]">
      <div className="border-b border-line p-3 lg:border-b-0 lg:border-r">
        {documents.map((d) => {
          const e = extractions.find((x) => x.document_id === d.id);
          const wrong = e && !DOC_SLOTS[d.slot].expects.includes(e.detected_type as DocType);
          return (
            <button key={d.id} onClick={() => setSel(d.id)} className={cx("mb-1 w-full rounded-lg px-3 py-2 text-left", sel === d.id ? "bg-brand-soft" : "hover:bg-line-2", d.superseded && "opacity-60")}>
              <div className="text-[12px] font-medium text-ink-3">{DOC_SLOTS[d.slot].label}{d.version > 1 && ` · v${d.version}`}</div>
              <div className="truncate text-[13px] font-medium text-ink">{d.filename}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {d.superseded && <Badge tone="neutral">replaced</Badge>}
                {wrong && <Badge tone="critical">wrong document</Badge>}
                {e?.provider === "none" && <Badge tone="critical">unreadable</Badge>}
                {e && !wrong && e.provider !== "none" && <Badge tone="good">{DOC_TYPE_LABELS[e.detected_type as DocType]}</Badge>}
              </div>
            </button>
          );
        })}
      </div>
      {doc && (
        <div className="grid min-w-0 xl:grid-cols-2">
          <div className="border-b border-line bg-line-2/50 p-4 xl:border-b-0 xl:border-r">
            <div className="relative overflow-hidden rounded-lg border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={doc.filename} src={`/api/documents/${doc.id}/preview`} className="block w-full" />
              {boxes.map((f) => {
                const [y1, x1, y2, x2] = f.box_2d!;
                return (
                  <div
                    key={f.key}
                    className={cx("pointer-events-none absolute rounded-sm border-2 transition-colors duration-150", hover === f.key ? "border-brand bg-brand/15" : "border-brand/40 bg-transparent")}
                    style={{ top: `${y1 / 10}%`, left: `${x1 / 10}%`, height: `${(y2 - y1) / 10}%`, width: `${(x2 - x1) / 10}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
              <span>{doc.filename} · {(doc.size / 1024).toFixed(0)} KB · {dateTime(doc.uploaded_at)}</span>
              <a href={`/api/documents/${doc.id}`} target="_blank" className="text-brand-2 hover:underline">Open original</a>
            </div>
            {boxes.length > 0 && <div className="mt-1 text-[12px] text-ink-3">Hover a field to see where it was read on the page.</div>}
          </div>
          <div className="min-w-0 p-4">
            {!ex ? (
              <Empty icon={FileSearch} title={doc.superseded ? "Replaced by a newer upload" : "Not read in the latest run"} />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={ex.provider === "none" ? "critical" : "brand"}><Sparkles className="h-3 w-3" />{ex.cached ? "Reused reading" : ex.provider === "none" ? "Not readable" : `Read by ${ex.model}`}</Badge>
                  <Badge tone="neutral">{DOC_TYPE_LABELS[ex.detected_type as DocType]} · {Math.round(ex.type_confidence * 100)}%</Badge>
                  <Badge tone={ex.legibility === "clear" ? "good" : "warn"}>{ex.legibility}</Badge>
                  {ex.pdf && <Badge tone="neutral">{ex.pdf.hasTextLayer ? "digital PDF" : "scanned PDF"}</Badge>}
                  {ex.latency_ms > 0 && <span className="text-xs text-ink-3">{secs(ex.latency_ms)}</span>}
                </div>
                {(ex.attempts?.length ?? 0) > 1 && <AttemptTrail attempts={ex.attempts!} />}
                {ex.notes && <p className="mb-3 rounded-lg bg-line-2 px-3 py-2 text-[12px] text-ink-2">{ex.notes}</p>}
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-[12px]">
                    <thead className="bg-line-2/70 text-left text-[12px] text-ink-3">
                      <tr><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Read from document</th><th className="px-3 py-2 font-medium">Confidence</th></tr>
                    </thead>
                    <tbody>
                      {ex.fields.map((f) => {
                        const formKey = FORM_FOR_FIELD[f.key];
                        const formVal = formKey ? String(app[formKey] ?? "") : "";
                        const same = formVal && norm(formVal) === norm(f.value);
                        const isAcct = f.key === "account_number";
                        return (
                          <tr key={f.key} onMouseEnter={() => setHover(f.key)} onMouseLeave={() => setHover(null)} className={cx("border-t border-line-2 align-top", hover === f.key && "bg-brand-soft/40")}>
                            <td className="px-3 py-2 text-ink-2">{f.key.replace(/_/g, " ")}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 break-words font-mono text-ink">
                                {isAcct && !reveal ? mask(f.value) : f.value}
                                {isAcct && <button aria-label="Reveal account number" onClick={() => setReveal((r) => !r)} className="text-ink-3 hover:text-ink">{reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
                              </div>
                              {f.source_quote && f.source_quote !== f.value && !isAcct && <div className="mt-0.5 text-[12px] italic text-ink-3">“{f.source_quote}”</div>}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {f.verified_by?.includes("text_layer") && <Badge tone="good">✓ found in PDF text</Badge>}
                                {f.second_opinion && <Badge tone={f.second_opinion.agrees ? "good" : "serious"}>{f.second_opinion.agrees ? "✓ second model agrees" : `second model read "${f.second_opinion.value}"`}</Badge>}
                                {formVal && <span className={cx("text-[12px]", same ? "text-good-ink" : "text-ink-3")}>{same ? "✓ matches form" : `form: ${isAcct && !reveal ? mask(formVal) : formVal}`}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2"><ConfidenceBar value={f.confidence} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AttemptTrail({ attempts }: { attempts: NonNullable<ExtractionRow["attempts"]> }) {
  return (
    <div className="mb-3 rounded-lg border border-line px-3 py-2">
      <div className="mb-1.5 text-[12px] font-medium text-ink-3">Fallback chain</div>
      <ol className="flex flex-wrap items-center gap-1.5 text-[12px]">
        {attempts.map((a, i) => (
          <li key={i} className="flex items-center gap-1.5" title={a.error ?? ""}>
            <span className={cx("rounded-md px-1.5 py-0.5", a.ok ? "bg-good-soft text-good-ink" : a.skipped ? "bg-line-2 text-ink-3 line-through" : "bg-critical-soft text-critical-ink")}>
              {PROVIDER_LABEL[a.provider.replace(" (second opinion)", "")] ?? a.provider}{a.provider.includes("second") ? " · 2nd opinion" : ""}
            </span>
            {i < attempts.length - 1 && <span className="text-ink-3">→</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" title={`${pct}% confidence`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line-2">
        <div className={cx("h-full rounded-full", value >= 0.9 ? "bg-good" : value >= 0.75 ? "bg-warn" : "bg-critical")} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[12px] text-ink-2">{pct}%</span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function Details({ app }: { app: Application }) {
  const [reveal, setReveal] = useState(false);
  const groups: { title: string; icon: React.ElementType; rows: [string, React.ReactNode][] }[] = [
    { title: "Company", icon: Building2, rows: [["Legal name", app.legal_name], ["Trade name", app.trade_name], ["Entity type", ENTITY_LABELS[app.entity_type]], ["Proprietor / signatory", app.owner_name], ["Category", app.category], ["Website", app.website]] },
    { title: "Tax & registration", icon: FileText, rows: [["PAN", app.pan], ["GSTIN", app.gstin], ["CIN", app.cin], ["Address", `${app.address}, ${app.city}, ${app.state} ${app.pincode}`]] },
    { title: "Contact", icon: UserRound, rows: [["Name", app.contact_name], ["Email", app.contact_email], ["Phone", app.contact_phone], ["Channel", CHANNEL_LABEL[app.source] ?? app.source]] },
    {
      title: "Bank", icon: Landmark, rows: [
        ["Account holder", app.bank_account_holder],
        ["Account number", <span key="acct" className="flex items-center gap-1.5">{reveal ? app.bank_account_number : mask(app.bank_account_number)}<button aria-label="Reveal account number" onClick={() => setReveal((r) => !r)} className="text-ink-3 hover:text-ink">{reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></span>],
        ["IFSC", app.bank_ifsc], ["Bank", app.bank_name],
      ],
    },
    { title: "MSME (Udyam)", icon: Gavel, rows: [["Registered", app.msme_registered === "yes" ? "Yes" : app.msme_registered === "no" ? "No" : "-"], ["Udyam number", app.udyam_number], ["Category (declared)", app.msme_category]] },
  ];
  return (
    <div className="grid gap-px bg-line md:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title} className="bg-surface p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-ink-3"><g.icon className="h-3.5 w-3.5" />{g.title}</div>
          <dl className="space-y-2">
            {g.rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[150px_1fr] gap-3 text-[13px]">
                <dt className="text-ink-3">{k}</dt>
                <dd className={cx("break-words text-ink", /PAN|GSTIN|CIN|IFSC|Account number|Udyam/.test(k) && "font-mono text-[12px]")}>{v || <span className="text-ink-3">-</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

const COMM_KIND: Record<string, string> = {
  information_request: "Information request", reminder: "Reminder", approval_notice: "Approval notice",
  review_alert: "Reviewer alert", reviewer_request: "Clarification request", manual_message: "Message from the team",
};
const COMM_STATUS: Record<string, { label: string; tone: "good" | "warn" | "critical" | "info" | "neutral" }> = {
  sent: { label: "Delivered", tone: "good" }, queued: { label: "Handed to n8n", tone: "info" },
  failed: { label: "Failed", tone: "critical" }, not_configured: { label: "Drafted - email not configured", tone: "warn" },
};

function Communications({ comms }: { comms: CommRow[] }) {
  const [open, setOpen] = useState<string | null>(comms[0]?.id ?? null);
  if (!comms.length) return <Empty icon={Mail} title="No communications yet">Requests, reminders and notices appear here.</Empty>;
  return (
    <div className="divide-y divide-line">
      {comms.map((c) => (
        <div key={c.id}>
          <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-line-2/50">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink">{c.subject}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <Badge tone="neutral">{COMM_KIND[c.kind] ?? c.kind}</Badge>
                <Badge tone={COMM_STATUS[c.status]?.tone ?? "neutral"}>{COMM_STATUS[c.status]?.label ?? c.status}</Badge>
                <Badge tone={c.channel === "smtp" ? "warn" : "neutral"}>{c.channel === "smtp" ? "SMTP backup" : "n8n"}</Badge>
                {Boolean(c.meta?.ai_worded) && <Badge tone="brand"><Sparkles className="h-3 w-3" />AI-worded</Badge>}
                <span>to {c.to_email}</span>
                {c.meta?.delivered_to && c.meta.delivered_to !== c.to_email ? <span>(delivered to {String(c.meta.delivered_to)})</span> : null}
                <span>· {dateTime(c.sent_at ?? c.created_at)}</span>
              </div>
            </div>
            <ChevronDown className={cx("h-4 w-4 shrink-0 text-ink-3 transition-transform", open === c.id && "rotate-180")} />
          </button>
          {open === c.id && c.body && (
            <div className="px-5 pb-4">
              <iframe title={c.subject} sandbox="" srcDoc={c.body} className="h-[440px] w-full rounded-lg border border-line bg-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Timeline({ audit, runs }: { audit: AuditRow[]; runs: ApplicationDetail["runs"] }) {
  return (
    <div className="grid lg:grid-cols-[1fr_300px]">
      <ol className="p-5">
        {audit.map((a, i) => (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < audit.length - 1 && <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />}
            <span className={cx("relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 bg-surface",
              a.actor === "vendor" ? "border-warn" : a.actor === "n8n" ? "border-info" : a.actor === "policy_engine" || a.actor === "system" ? "border-brand" : "border-good")} />
            <div className="min-w-0">
              <div className="text-[13px] text-ink"><span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span> <span className="text-ink-3">by {a.actor === "policy_engine" ? "policy engine" : a.actor}</span></div>
              <AuditDetail a={a} />
              <div className="text-[12px] text-ink-3">{dateTime(a.ts)}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-line p-5 lg:border-l lg:border-t-0">
        <div className="mb-2 text-[12px] font-semibold text-ink-3">Verification runs</div>
        {runs.map((r) => (
          <Link key={r.id} href={`/runs/${r.id}`} className="mb-1.5 block rounded-lg border border-line px-3 py-2 hover:bg-line-2/60">
            <div className="flex items-center justify-between"><Mono>{r.id}</Mono><span className="text-[12px] text-ink-3">{secs(r.duration_ms)}</span></div>
            <div className="text-[12px] text-ink-2">{r.trigger.replace("_", " ")} · {r.outcome?.replace("_", " ") ?? r.status}</div>
            <div className="text-[12px] text-ink-3">{dateTime(r.started_at)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AuditDetail({ a }: { a: AuditRow }) {
  const d = a.detail ?? {};
  let text = "";
  if (a.action === "decision") text = String(d.headline ?? "");
  else if (a.action.startsWith("review_") || a.action === "clarification_requested") text = String(d.note ?? "");
  else if (a.action === "resubmitted" || a.action === "details_confirmed") {
    const docs = (d.documents as { slot: string; filename: string }[] | undefined) ?? [];
    const fields = Object.entries((d.fields as Record<string, { from: string; to: string }>) ?? {});
    text = [d.channel === "email" ? "by email reply" : "", ...docs.map((x) => `uploaded ${x.filename}`), ...fields.map(([k, v]) => `${k}: ${v.from || "-"} → ${v.to}`)].filter(Boolean).join(" · ");
  } else if (a.action === "submitted") text = d.channel ? `via ${CHANNEL_LABEL[String(d.channel)] ?? d.channel}` : "";
  else if (a.action === "vendor_contacted") text = ((d.items as string[]) ?? []).join(" · ");
  else if (a.action === "email_sent" || a.action === "reminder_sent") text = [String(d.subject ?? (d.reminder_no ? `Reminder #${d.reminder_no}` : "")), d.channel === "smtp" ? `(SMTP backup: ${String(d.reason ?? "")})` : ""].join(" ");
  else if (a.action === "erp_exported") text = `${String(d.vendor_code)} · ${String(d.format)}`;
  if (!text) return null;
  return <div className="mt-0.5 text-[12px] text-ink-2">{text}</div>;
}
