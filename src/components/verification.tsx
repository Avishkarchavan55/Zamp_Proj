"use client";

import {
  ArrowRight, Ban, BookOpenCheck, ChevronDown, ClipboardList, Clock3, FileWarning, Gavel, Quote,
  ShieldCheck, Sparkles, TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { DOC_SLOTS } from "@/lib/policy";
import type { Decision, Evidence } from "@/lib/types";
import { ROUTE_LABEL, STAGES } from "@/lib/ui-meta";
import type { CheckRow } from "./api-types";
import { Badge, CheckIcon, cx } from "./ui";

// ------------------------------------------------------------------------------------------------
// Evidence
// ------------------------------------------------------------------------------------------------

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens?.length) return <>{text}</>;
  const set = new Set(tokens.map((t) => t.toUpperCase()));
  return (
    <>
      {text.split(/(\s+)/).map((w, i) =>
        set.has(w.replace(/[^A-Za-z0-9]/g, "").toUpperCase()) ? (
          <mark key={i} className="rounded bg-serious-soft px-0.5 font-semibold text-serious-ink">{w}</mark>
        ) : (
          <span key={i}>{w}</span>
        ),
      )}
    </>
  );
}

export function EvidenceView({ ev, status }: { ev: Evidence; status: string }) {
  const slotLabel = ev.document_slot ? DOC_SLOTS[ev.document_slot]?.label : null;
  const hasPair = ev.form != null && ev.document != null;
  const matches = (ev.matches as { id: string; legal_name: string; status?: string; pan?: string }[] | undefined) ?? [];
  const bad = status === "failed" || status === "warning";
  return (
    <div className="space-y-2.5 text-[12.5px]">
      {hasPair && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Submitted on form</div>
            <div className="mt-0.5 break-words font-mono text-[12.5px] text-ink">
              <Highlight text={String(ev.form)} tokens={bad ? ev.diff?.left ?? [] : []} />
            </div>
          </div>
          <div className={cx("rounded-lg border px-3 py-2", bad ? "border-serious/40 bg-serious-soft/40" : "border-line bg-surface")}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{slotLabel ?? ev.source ?? "Evidence"}</div>
            <div className="mt-0.5 break-words font-mono text-[12.5px] text-ink">
              <Highlight text={String(ev.document)} tokens={bad ? ev.diff?.right ?? [] : []} />
            </div>
          </div>
        </div>
      )}
      {!hasPair && ev.form && (
        <div className="text-ink-2">Value checked: <span className="font-mono text-ink">{String(ev.form)}</span></div>
      )}
      {ev.expected != null && ev.actual != null && (
        <div className="flex flex-wrap items-center gap-2 text-ink-2">
          <span>Expected <span className="font-mono text-ink">{String(ev.expected)}</span></span>
          <ArrowRight className="h-3 w-3" />
          <span>found <span className={cx("font-mono", bad ? "text-critical-ink" : "text-ink")}>{String(ev.actual)}</span></span>
        </div>
      )}
      {ev.source_quote && (
        <div className="flex gap-2 rounded-lg bg-line-2 px-3 py-2 text-ink-2">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
          <span className="italic">“{ev.source_quote}”</span>
        </div>
      )}
      {matches.length > 0 && (
        <div className="rounded-lg border border-critical/30 bg-critical-soft/50 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-critical-ink">Matching records</div>
          {matches.map((m) => (
            <a key={m.id} href={`/applications/${m.id}`} className="mt-1 flex items-center gap-2 text-ink hover:underline">
              <span className="font-mono text-[12px]">{m.id}</span> {m.legal_name}
              {m.pan && <span className="text-ink-3">· PAN {m.pan}</span>}
            </a>
          ))}
        </div>
      )}
      {Boolean(ev.bank || ev.branch) && (
        <div className="text-ink-2">
          Directory: <span className="text-ink">{String(ev.bank)}</span> · {String(ev.branch)} · {String(ev.city)}
        </div>
      )}
      {ev.source && <div className="text-[11.5px] text-ink-3">Source: {ev.source}</div>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Check rows
// ------------------------------------------------------------------------------------------------

const ROUTE_TONE = { vendor: "warn", review: "serious", reject: "critical", condition: "warn", none: "neutral" } as const;

export function CheckRowView({ c, defaultOpen = false }: { c: CheckRow; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = !!(c.evidence || c.rule);
  const notPassed = c.status !== "passed" && c.status !== "skipped";
  return (
    <div className={cx("animate-rise border-b border-line-2 last:border-0", notPassed && "bg-[#fffdfa]")}>
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        className={cx("flex w-full items-start gap-3 px-4 py-2.5 text-left", expandable && "hover:bg-line-2/60")}
      >
        <CheckIcon status={c.status} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink">{c.label}</span>
            {notPassed && c.route !== "none" && <Badge tone={ROUTE_TONE[c.route]}>{ROUTE_LABEL[c.route]}</Badge>}
          </div>
          <p className={cx("mt-0.5 text-[12.5px] leading-relaxed", notPassed ? "text-ink-2" : "text-ink-3")}>{c.message}</p>
        </div>
        {expandable && <ChevronDown className={cx("mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />}
      </button>
      {open && (
        <div className="space-y-2.5 px-4 pb-3.5 pl-11">
          {c.evidence && <EvidenceView ev={c.evidence} status={c.status} />}
          {c.rule && (
            <div className="flex gap-2 text-[12px] text-ink-3">
              <BookOpenCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span><span className="font-medium text-ink-2">Rule:</span> {c.rule}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const isIssue = (c: CheckRow) => c.status === "failed" || c.status === "warning" || c.status === "unverified";

export function CheckGroups({ checks, openIssues = true, toggle = true }: { checks: CheckRow[]; openIssues?: boolean; toggle?: boolean }) {
  const issueCount = checks.filter(isIssue).length;
  const [onlyIssues, setOnlyIssues] = useState(toggle && issueCount > 0);
  const visible = onlyIssues ? checks.filter(isIssue) : checks;
  const groups = STAGES.map((s) => ({ stage: s, items: visible.filter((c) => c.category === s.id) })).filter((g) => g.items.length);
  return (
    <div className="divide-y divide-line">
      {toggle && (
        <div className="flex items-center gap-1 px-4 py-2.5">
          {[
            { v: true, label: `Issues & unverified (${issueCount})` },
            { v: false, label: `All checks (${checks.length})` },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => setOnlyIssues(o.v)}
              className={cx("rounded-lg px-3 py-1 text-[12.5px] font-medium", onlyIssues === o.v ? "bg-ink text-canvas" : "text-ink-2 hover:bg-line-2")}
            >
              {o.label}
            </button>
          ))}
          {onlyIssues && <span className="ml-2 text-xs text-ink-3">{checks.length - issueCount} checks passed — hidden</span>}
        </div>
      )}
      {groups.map(({ stage, items }) => {
        const failed = items.filter((c) => c.status === "failed").length;
        const flagged = items.filter((c) => c.status === "warning" || c.status === "unverified").length;
        return (
          <div key={stage.id}>
            <div className="flex items-center justify-between bg-line-2/60 px-4 py-2">
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-2">{stage.label}</div>
              <div className="flex gap-1.5 text-[11.5px] text-ink-3">
                <span>{items.filter((c) => c.status === "passed").length} passed</span>
                {failed > 0 && <span className="font-medium text-critical-ink">· {failed} failed</span>}
                {flagged > 0 && <span className="font-medium text-serious-ink">· {flagged} flagged</span>}
              </div>
            </div>
            {items.map((c) => (
              <CheckRowView key={c.id} c={c} defaultOpen={openIssues && (c.status === "failed" || c.status === "warning") && c.route !== "none"} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Decision panel
// ------------------------------------------------------------------------------------------------

const OUTCOME_STYLE = {
  approved: { icon: ShieldCheck, edge: "border-l-good", tint: "text-good-ink", label: "Approved" },
  awaiting_vendor: { icon: Clock3, edge: "border-l-warn", tint: "text-warn-ink", label: "Waiting for the vendor" },
  in_review: { icon: TriangleAlert, edge: "border-l-serious", tint: "text-serious-ink", label: "Needs your decision" },
  rejected: { icon: Ban, edge: "border-l-critical", tint: "text-critical-ink", label: "Rejected" },
} as const;

/** What happens next, in one sentence, per outcome. */
const NEXT_STEP = {
  approved: "Vendor can be created in the ERP. Payment holds below apply until cleared.",
  awaiting_vendor: "We've emailed the vendor exactly what to fix. Reminders go out automatically; the checks re-run when they reply.",
  in_review: "The documents disagree. Compare the evidence below, then approve with a reason, ask the vendor, or reject.",
  rejected: "Do not create this vendor or release any payment. A person informs the vendor.",
} as const;

export function DecisionPanel({ decision }: { decision: Decision; compact?: boolean }) {
  const [more, setMore] = useState(false);
  const s = OUTCOME_STYLE[decision.outcome];
  const Icon = s.icon;
  const human = decision.decided_by !== "policy_engine";
  const reasons = decision.reasons.slice(0, 4);
  return (
    <div className={cx("animate-rise overflow-hidden rounded-xl border border-l-4 border-line bg-surface", s.edge)}>
      <div className="px-6 py-5">
        <div className="flex items-start gap-3">
          <Icon className={cx("mt-0.5 h-6 w-6 shrink-0", s.tint)} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[19px] font-semibold leading-snug text-ink">{decision.headline}</h3>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{NEXT_STEP[decision.outcome]}</p>
          </div>
        </div>

        {decision.ai_brief && (
          <div className="mt-5 rounded-lg bg-brand-soft px-4 py-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-2">
              <Sparkles className="h-3.5 w-3.5" /> AI summary for the reviewer
            </div>
            <p className="text-[14.5px] leading-relaxed text-ink">{decision.ai_brief.summary}</p>
            <div className="mt-2 grid gap-2 text-[13.5px] sm:grid-cols-2">
              <p><span className="font-medium text-good-ink">If innocent: </span><span className="text-ink-2">{decision.ai_brief.likely_benign}</span></p>
              <p><span className="font-medium text-critical-ink">If not: </span><span className="text-ink-2">{decision.ai_brief.likely_risk}</span></p>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">Written by {decision.ai_brief.model} from the checks below. It does not change the decision.</p>
          </div>
        )}

        {reasons.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Why</div>
            <ul className="space-y-2">
              {reasons.map((r) => (
                <li key={r.code} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                  <span className={cx("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", r.route === "reject" ? "bg-critical" : r.route === "vendor" ? "bg-warn" : "bg-serious")} />
                  <span>{r.text.split(": ").slice(1).join(": ") || r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {decision.requested_items.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Asked from the vendor</div>
            <div className="flex flex-wrap gap-2">
              {decision.requested_items.map((i) => (
                <span key={i.code} title={i.instruction} className="inline-flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn-soft px-3 py-1.5 text-[13.5px] text-ink">
                  <FileWarning className="h-3.5 w-3.5 text-warn-ink" />{i.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {decision.conditions.length > 0 && decision.outcome === "approved" && (
          <div className="mt-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Before the first payment</div>
            <ul className="space-y-1.5">
              {decision.conditions.map((c) => (
                <li key={c} className="flex gap-2.5 text-[14px] text-ink-2"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button onClick={() => setMore((m) => !m)} className="flex w-full items-center justify-between border-t border-line px-6 py-3 text-[13.5px] text-ink-2 transition-colors duration-150 hover:bg-line-2/60">
        <span className="flex items-center gap-2">
          {human ? <Gavel className="h-4 w-4 text-ink-3" /> : <BookOpenCheck className="h-4 w-4 text-ink-3" />}
          {human ? `Decided by ${decision.decided_by}` : "Decided by the rule engine"} · {decision.counts.passed} checks passed
          {decision.counts.failed + decision.counts.warning > 0 && `, ${decision.counts.failed + decision.counts.warning} raised issues`}
        </span>
        <span className="flex items-center gap-1 text-ink-3">How was this decided? <ChevronDown className={cx("h-4 w-4 transition-transform", more && "rotate-180")} /></span>
      </button>
      {more && (
        <div className="space-y-4 border-t border-line bg-line-2/40 px-6 py-4">
          {decision.rule_trace.length > 0 && (
            <ol className="space-y-2">
              {decision.rule_trace.map((t) => (
                <li key={t.rule} className={cx("rounded-lg border px-3 py-2 text-[13px]", t.matched ? "border-brand/40 bg-surface" : "border-transparent text-ink-3")}>
                  <div className="flex items-center gap-2 font-medium">
                    <span className={t.matched ? "text-ink" : ""}>{t.rule}</span>
                    {t.matched && <Badge tone="brand">Applied</Badge>}
                  </div>
                  <div className={cx("mt-0.5", t.matched ? "text-ink-2" : "")}>{t.description}</div>
                </li>
              ))}
            </ol>
          )}
          {decision.conditions.length > 0 && decision.outcome !== "approved" && (
            <div className="text-[13px] text-ink-2"><span className="font-medium text-ink">Also noted: </span>{decision.conditions.join(" ")}</div>
          )}
          {decision.summary && human && <div className="text-[13px] text-ink-2"><span className="font-medium text-ink">Reviewer note: </span>{decision.summary}</div>}
        </div>
      )}
    </div>
  );
}
