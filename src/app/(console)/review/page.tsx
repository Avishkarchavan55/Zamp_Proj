"use client";

import { ArrowRight, CheckCircle2, Clock3, FileSpreadsheet, Globe, Mail, ShieldAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { AppListRow } from "@/components/api-types";
import { Card, Empty, PageHeader, Skeleton, ago, cx } from "@/components/ui";
import { ENTITY_SHORT, issueTitle } from "@/lib/ui-meta";

/** Issue families a reviewer thinks in — used for the filter chips. */
const FAMILIES = [
  { key: "bank", label: "Bank & payments", test: /bank|ifsc|cheque|doc_metadata/ },
  { key: "identity", label: "GST, PAN & names", test: /gst|pan|cin|name/ },
  { key: "msme", label: "MSME", test: /msme|udyam/ },
  { key: "duplicate", label: "Possible duplicate", test: /duplicate_vendor/ },
  { key: "documents", label: "Documents", test: /^doc\.|legib|type/ },
] as const;
type Family = (typeof FAMILIES)[number]["key"];

/** Fraud-shaped signals rank above ordinary mismatches. */
const HIGH_RISK = /^risk\.|ext\.bank_name|doc_metadata|xref\.gstin_pan/;

const CHANNEL = { portal: { icon: Globe, label: "Portal" }, email: { icon: Mail, label: "Email" }, google_form: { icon: FileSpreadsheet, label: "Google Form" } } as const;

const families = (a: AppListRow) => new Set(FAMILIES.filter((f) => (a.reasons ?? []).some((r) => f.test.test(r.code))).map((f) => f.key));
const isHighRisk = (a: AppListRow) => (a.reasons ?? []).some((r) => HIGH_RISK.test(r.code));

export default function ReviewQueue() {
  const { data } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 4000 });
  const [filter, setFilter] = useState<Family | "all">("all");
  const [sort, setSort] = useState<"oldest" | "risk">("oldest");

  const all = (data ?? []).filter((a) => a.status === "in_review");
  const shown = all
    .filter((a) => filter === "all" || families(a).has(filter))
    .sort((a, b) => (sort === "risk" ? Number(isHighRisk(b)) - Number(isHighRisk(a)) : 0) || a.updated_at.localeCompare(b.updated_at));
  const waitingOnVendor = (data ?? []).filter((a) => a.status === "awaiting_vendor").length;
  const oldest = all.reduce<AppListRow | null>((o, a) => (!o || a.updated_at < o.updated_at ? a : o), null);
  const highRisk = all.filter(isHighRisk).length;

  return (
    <div>
      <PageHeader
        title="Needs your decision"
        subtitle={
          !data ? "…" : all.length
            ? "Vendors whose documents don't add up. Everything else was decided automatically."
            : "Nothing to decide — every vendor was handled automatically."
        }
      />

      {data && all.length > 0 && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Summary icon={TriangleAlert} tone="text-serious-ink" value={all.length} label={`vendor${all.length === 1 ? "" : "s"} to decide`} />
            <Summary icon={ShieldAlert} tone="text-critical-ink" value={highRisk} label="with fraud-type signals" />
            <Summary icon={Clock3} tone="text-ink-3" value={oldest ? ago(oldest.updated_at).replace(" ago", "") : "—"} label="longest wait" />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by issue">
              <Chip pressed={filter === "all"} onClick={() => setFilter("all")} label="All" n={all.length} />
              {FAMILIES.map((f) => {
                const n = all.filter((a) => families(a).has(f.key)).length;
                return n ? <Chip key={f.key} pressed={filter === f.key} onClick={() => setFilter(f.key)} label={f.label} n={n} /> : null;
              })}
            </div>
            <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
              Sort
              <select className="input py-1.5" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="oldest">Waiting longest</option>
                <option value="risk">Highest risk first</option>
              </select>
            </label>
          </div>
        </>
      )}

      {!data ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : all.length === 0 ? (
        <Card><Empty icon={CheckCircle2} title="You're all caught up">New cases appear here only when documents disagree or something looks risky.</Empty></Card>
      ) : shown.length === 0 ? (
        <Card><Empty title="No vendors with this kind of issue">
          <button className="font-medium text-brand hover:underline" onClick={() => setFilter("all")}>Show all {all.length}</button>
        </Empty></Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => <Case key={a.id} a={a} />)}
        </ul>
      )}

      {data && waitingOnVendor > 0 && (
        <p className="mt-5 text-[14px] text-ink-3">
          {waitingOnVendor} other vendor{waitingOnVendor === 1 ? " is" : "s are"} waiting to fix something — they&apos;re emailed and reminded automatically.{" "}
          <Link href="/applications?status=awaiting_vendor" className="font-medium text-brand hover:underline">See them</Link>
        </p>
      )}
    </div>
  );
}

function Case({ a }: { a: AppListRow }) {
  const high = isHighRisk(a);
  const titles = [...new Set((a.reasons ?? []).map((r) => issueTitle(r.code)))];
  // The first reason, in the words of the check that raised it ("Label: message").
  const lead = (a.reasons ?? [])[0]?.text.split(": ").slice(1).join(": ");
  const ch = CHANNEL[a.source as keyof typeof CHANNEL] ?? CHANNEL.portal;
  return (
    <li>
      <Link
        href={`/applications/${a.id}`}
        className={cx(
          "group flex flex-col gap-4 rounded-xl border bg-surface p-5 transition-colors duration-150 hover:border-brand/50 sm:flex-row sm:items-start",
          high ? "border-critical/30" : "border-line",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12.5px] font-semibold", high ? "bg-critical-soft text-critical-ink" : "bg-serious-soft text-serious-ink")}>
              {high ? <ShieldAlert className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
              {high ? "Higher risk" : "Needs a look"}
            </span>
            <span className="text-[16px] font-semibold text-ink">{a.legal_name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
            <span>{ENTITY_SHORT[a.entity_type]} · {a.city}</span>
            <span className="inline-flex items-center gap-1"><ch.icon className="h-3.5 w-3.5" />{ch.label}</span>
            <span className="font-mono text-[12px]">{a.id}</span>
          </div>
          {lead && <p className="mt-2.5 line-clamp-2 max-w-3xl text-[14px] leading-snug text-ink-2">{lead}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {titles.map((t) => (
              <span key={t} className="inline-flex items-center rounded-md border border-line bg-line-2/60 px-2 py-0.5 text-[12.5px] font-medium text-ink-2">{t}</span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-3"><Clock3 className="h-3.5 w-3.5" />waiting {ago(a.updated_at).replace(" ago", "")}</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13.5px] font-medium text-white transition-colors group-hover:bg-brand-2">
            Review <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </li>
  );
}

function Summary({ icon: Icon, tone, value, label }: { icon: React.ElementType; tone: string; value: number | string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <Icon className={cx("h-5 w-5 shrink-0", tone)} />
      <div className="leading-tight">
        <div className="text-[20px] font-semibold text-ink">{value}</div>
        <div className="text-[12.5px] text-ink-3">{label}</div>
      </div>
    </div>
  );
}

function Chip({ pressed, onClick, label, n }: { pressed: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150",
        pressed ? "border-brand bg-brand-soft text-brand-2" : "border-line bg-surface text-ink-2 hover:bg-line-2",
      )}
    >
      {label}
      <span className={cx("rounded-full px-1.5 text-[11.5px] tabular-nums", pressed ? "bg-brand/15" : "bg-line-2")}>{n}</span>
    </button>
  );
}
