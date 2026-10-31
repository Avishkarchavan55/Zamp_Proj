"use client";

import { CheckCircle2, ChevronRight, Clock3, FileSpreadsheet, Globe, Mail, ShieldAlert, TriangleAlert } from "@/components/icons";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { AppListRow } from "@/components/api-types";
import { Card, Empty, PageHeader, Skeleton, ago, cx } from "@/components/ui";
import { isHighRisk, isUnresponsive, needsAttention } from "@/lib/attention";
import { ENTITY_SHORT, issueTitle } from "@/lib/ui-meta";

/** Issue families a reviewer thinks in. They drive the tabs. */
const FAMILIES = [
  { key: "bank", label: "Bank and payments", test: /bank|ifsc|cheque|doc_metadata/ },
  { key: "identity", label: "GST, PAN and names", test: /gst|pan|cin|name/ },
  { key: "msme", label: "MSME", test: /msme|udyam/ },
  { key: "duplicate", label: "Possible duplicate", test: /duplicate_vendor/ },
  { key: "documents", label: "Documents", test: /^doc\.|legib|type/ },
  { key: "noreply", label: "No reply", test: /(?!)/ },
] as const;
type Family = (typeof FAMILIES)[number]["key"];

const CHANNEL = {
  portal: { icon: Globe, label: "Portal" },
  email: { icon: Mail, label: "Email" },
  google_form: { icon: FileSpreadsheet, label: "Google Form" },
} as const;

const families = (a: AppListRow) => {
  const set = new Set<Family>(FAMILIES.filter((f) => (a.reasons ?? []).some((r) => f.test.test(r.code))).map((f) => f.key));
  if (isUnresponsive(a)) set.add("noreply");
  return set;
};

export default function ReviewQueue() {
  const { data } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 4000 });
  const [filter, setFilter] = useState<Family | "all">("all");
  const [sort, setSort] = useState<"oldest" | "risk">("oldest");

  const all = (data ?? []).filter(needsAttention);
  const shown = all
    .filter((a) => filter === "all" || families(a).has(filter))
    .sort((a, b) => (sort === "risk" ? Number(isHighRisk(b)) - Number(isHighRisk(a)) : 0) || a.updated_at.localeCompare(b.updated_at));
  const waitingOnVendor = (data ?? []).filter((a) => a.status === "awaiting_vendor" && !isUnresponsive(a)).length;
  const oldest = all.reduce<AppListRow | null>((o, a) => (!o || a.updated_at < o.updated_at ? a : o), null);
  const highRisk = all.filter(isHighRisk).length;

  return (
    <div>
      <PageHeader
        title="Needs attention"
        subtitle={
          !data ? " " : all.length
            ? <>
                <span className="font-medium text-ink">{all.length} vendor{all.length === 1 ? "" : "s"}</span>
                {highRisk > 0 && <>, <span className="font-medium text-critical-ink">{highRisk} with fraud-type signals</span></>}
                {oldest && <>. Longest wait: {ago(oldest.updated_at).replace(" ago", "")}.</>}
              </>
            : "Nothing needs your attention. Everything is being handled automatically."
        }
      />

      {!data ? (
        <Card><div className="space-y-px"><Skeleton className="h-16 rounded-none" /><Skeleton className="h-16 rounded-none" /><Skeleton className="h-16 rounded-none" /></div></Card>
      ) : all.length === 0 ? (
        <Card><Empty icon={CheckCircle2} title="You're all caught up">Cases appear here when documents disagree, something looks risky, or a supplier stops replying.</Empty></Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-line px-4">
            <div role="tablist" aria-label="Filter by issue" className="-mb-px flex flex-wrap gap-x-5">
              <Tab selected={filter === "all"} onClick={() => setFilter("all")} label="All" n={all.length} />
              {FAMILIES.map((f) => {
                const n = all.filter((a) => families(a).has(f.key)).length;
                return n ? <Tab key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)} label={f.label} n={n} /> : null;
              })}
            </div>
            <label className="flex items-center gap-2 py-2 text-[13px] text-ink-2">
              Sort by
              <select className="input h-8 min-h-8 py-0 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="oldest">Waiting longest</option>
                <option value="risk">Highest risk</option>
              </select>
            </label>
          </div>

          <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_120px_96px_16px] gap-4 border-b border-line bg-line-2 px-4 py-2 text-[12px] font-semibold text-ink-2 md:grid">
            <span>Vendor</span><span>What needs attention</span><span>Type</span><span>Waiting</span><span />
          </div>

          {shown.length === 0 ? (
            <Empty title="No vendors with this kind of issue">
              <button className="font-medium text-brand hover:underline" onClick={() => setFilter("all")}>Show all {all.length}</button>
            </Empty>
          ) : (
            <ul className="divide-y divide-line">{shown.map((a) => <Case key={a.id} a={a} />)}</ul>
          )}
        </Card>
      )}

      {data && waitingOnVendor > 0 && (
        <p className="mt-4 text-[13px] text-ink-3">
          {waitingOnVendor} other vendor{waitingOnVendor === 1 ? " is" : "s are"} waiting to fix something and {waitingOnVendor === 1 ? "is" : "are"} reminded automatically.{" "}
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
  const silent = isUnresponsive(a);
  const lead = silent
    ? `No reply after every reminder. Still waiting for: ${(a.requested_items ?? []).map((i) => i.title).join(", ") || "the requested items"}.`
    : (a.reasons ?? [])[0]?.text.split(": ").slice(1).join(": ");
  const ch = CHANNEL[a.source as keyof typeof CHANNEL] ?? CHANNEL.portal;
  return (
    <li>
      <Link
        href={`/applications/${a.id}`}
        className="grid grid-cols-1 items-start gap-1.5 px-4 py-3 transition-colors duration-150 hover:bg-line-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_120px_96px_16px] md:gap-4"
      >
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-ink">{a.legal_name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
            <span>{ENTITY_SHORT[a.entity_type]}, {a.city}</span>
            <span className="inline-flex items-center gap-1"><ch.icon className="h-3 w-3" />{ch.label}</span>
            <span className="font-mono">{a.id}</span>
          </span>
        </span>
        <span className="min-w-0">
          {lead && <span className="line-clamp-2 text-[13px] leading-5 text-ink">{lead}</span>}
          {!silent && titles.length > 1 && <span className="mt-0.5 block truncate text-[12px] text-ink-3">{titles.join(", ")}</span>}
        </span>
        <span>
          <span className={cx("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[12px] font-medium", silent ? "bg-warn-soft text-warn-ink" : high ? "bg-critical-soft text-critical-ink" : "bg-serious-soft text-serious-ink")}>
            {silent ? <Clock3 className="h-3.5 w-3.5" /> : high ? <ShieldAlert className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {silent ? "No reply" : high ? "Higher risk" : "Needs a look"}
          </span>
        </span>
        <span className="text-[13px] tabular-nums text-ink-2">{ago(a.updated_at).replace(" ago", "")}</span>
        <ChevronRight className="hidden h-4 w-4 self-center text-ink-3 md:block" />
      </Link>
    </li>
  );
}

function Tab({ selected, onClick, label, n }: { selected: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cx(
        "inline-flex h-10 items-center gap-1.5 border-b-2 text-[13px] transition-colors duration-150",
        selected ? "border-brand font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink",
      )}
    >
      {label}<span className="tabular-nums text-ink-3">{n}</span>
    </button>
  );
}
