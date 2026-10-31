"use client";

import { Check, X } from "@/components/icons";
import type { AppStatus } from "@/lib/types";
import { CHANNEL_LABEL } from "@/lib/ui-meta";
import type { AuditRow } from "./api-types";
import { cx, dateTime } from "./ui";

type StepState = "done" | "active" | "todo" | "skipped" | "failed";
interface Step {
  title: string;
  detail: string;
  state: StepState;
}

/**
 * Where a vendor is in the process, as five plain steps:
 * Applied → Checked → Vendor fixes (if needed) → Your decision (if needed) → Outcome.
 */
export function Journey({ status, source, audit }: { status: AppStatus; source: string; audit: AuditRow[] }) {
  const has = (action: string) => audit.some((a) => a.action === action);
  const first = (action: string) => [...audit].reverse().find((a) => a.action === action);
  const submitted = first("submitted");
  const vendorAsked = has("vendor_contacted") || has("clarification_requested");
  const vendorReplied = has("resubmitted") || has("details_confirmed");
  const reviewed = has("review_approved") || has("review_rejected");

  const steps: Step[] = [
    { title: "Applied", detail: `${CHANNEL_LABEL[source] ?? source}${submitted ? ` · ${dateTime(submitted.ts)}` : ""}`, state: "done" },
    {
      title: "Checked automatically",
      detail: status === "processing" ? "Running now…" : "Documents, IDs, bank & registry",
      state: status === "processing" ? "active" : "done",
    },
    {
      title: "Vendor fixes",
      detail: status === "awaiting_vendor" ? "Waiting for the vendor" : vendorAsked ? (vendorReplied ? "Vendor responded" : "Asked") : "Nothing to fix",
      state: status === "awaiting_vendor" ? "active" : vendorAsked ? "done" : "skipped",
    },
    {
      title: "Your decision",
      detail: status === "in_review" ? "Needed now" : reviewed ? "Decided by reviewer" : "Not needed",
      state: status === "in_review" ? "active" : reviewed ? "done" : "skipped",
    },
    {
      title: status === "rejected" ? "Rejected" : "Approved",
      detail: status === "approved" ? "Ready for the ERP" : status === "rejected" ? "No payments" : "Pending",
      state: status === "approved" ? "done" : status === "rejected" ? "failed" : "todo",
    },
  ];

  return (
    <ol className="grid grid-cols-2 gap-3 rounded-md border border-line bg-surface p-4 sm:grid-cols-5 sm:gap-0 sm:p-5">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 sm:flex-col sm:gap-2 sm:pr-3">
          {i < steps.length - 1 && <span className={cx("absolute left-4 right-0 top-4 hidden h-0.5 sm:block", s.state === "done" ? "bg-good/50" : "bg-line")} style={{ left: "2.25rem" }} />}
          <Dot state={s.state} />
          <div className="min-w-0">
            <div className={cx("text-[14px] font-medium", s.state === "skipped" || s.state === "todo" ? "text-ink-3" : "text-ink")}>{s.title}</div>
            <div className={cx("text-[12px]", s.state === "active" ? "font-medium text-brand" : "text-ink-3")}>{s.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Dot({ state }: { state: StepState }) {
  const base = "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full";
  if (state === "done") return <span className={cx(base, "bg-good text-white")}><Check className="h-4 w-4" /></span>;
  if (state === "failed") return <span className={cx(base, "bg-critical text-white")}><X className="h-4 w-4" /></span>;
  if (state === "active") return <span className={cx(base, "animate-pulse-ring bg-brand")}><span className="h-2.5 w-2.5 rounded-full bg-white" /></span>;
  if (state === "skipped") return <span className={cx(base, "border-2 border-dashed border-line bg-surface")} />;
  return <span className={cx(base, "border-2 border-line bg-surface")} />;
}
