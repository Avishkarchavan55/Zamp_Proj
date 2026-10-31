"use client";

import { ArrowRight, ChevronRight, Plus, QrCode } from "@/components/icons";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { AppListRow, AuditRow } from "@/components/api-types";
import { Badge, Button, Card, CardHeader, Empty, PageHeader, Skeleton, StatusPill, ago, cx } from "@/components/ui";
import { isHighRisk, isUnresponsive, needsAttention } from "@/lib/attention";
import { eventLabel } from "@/lib/activity";
import { issueTitle, rejectionReason } from "@/lib/ui-meta";

interface Stats {
  topIssues: { code: string; label: string; n: number }[];
  activity: AuditRow[];
  sources: { source: string; n: number }[];
}

const CHANNELS = [
  { key: "portal", label: "Portal", color: "var(--color-ch-portal)" },
  { key: "email", label: "Email", color: "var(--color-ch-email)" },
  { key: "google_form", label: "Google Form", color: "var(--color-ch-form)" },
] as const;

export default function Overview() {
  const { data: stats } = useSWR<Stats>("/api/stats", { refreshInterval: 5000 });
  const { data: apps } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 5000 });
  const [now] = useState(() => Date.now());

  const all = apps ?? [];
  const count = (s: AppListRow["status"]) => all.filter((a) => a.status === s).length;
  const decided = all.filter((a) => a.status !== "processing");
  const auto = decided.filter((a) => a.status !== "in_review" && (a.decided_by === "policy_engine" || !a.decided_by)).length;
  const attention = all.filter(needsAttention).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const waiting = all.filter((a) => a.status === "awaiting_vendor" && !isUnresponsive(a));
  const oldestWaiting = waiting.reduce<AppListRow | null>((o, a) => (!o || a.updated_at < o.updated_at ? a : o), null);
  const last24 = all.filter((a) => now - new Date(a.created_at).getTime() < 24 * 3600_000).length;
  const rejected = all.filter((a) => a.status === "rejected");
  const fraud = rejected.filter((a) => rejectionReason(a).kind === "fraud").length;
  const approvedPct = decided.length ? Math.round((count("approved") / decided.length) * 100) : 0;
  const autoPct = decided.length ? Math.round((auto / decided.length) * 100) : 0;
  const share = (n: number) => (all.length ? Math.round((n / all.length) * 100) : 0);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={
          !apps ? " " : attention.length
            ? <><span className="font-medium text-ink">{attention.length} vendor{attention.length === 1 ? "" : "s"} need{attention.length === 1 ? "s" : ""} your attention.</span> Everything else is handled automatically.</>
            : "Nothing needs your attention right now. Everything is handled automatically."
        }
        right={
          <>
            <Link href="/share"><Button variant="secondary"><QrCode className="h-4 w-4" />Invite a supplier</Button></Link>
            <Link href="/apply" target="_blank"><Button><Plus className="h-4 w-4" />New application</Button></Link>
          </>
        }
      />

      {/* One strip: each count says what it means and links into the list it describes. */}
      <Card className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-line [&>*]:max-lg:border-b [&>*:not(:last-child)]:lg:border-r">
        <Stat label="Applied" value={apps ? all.length : undefined} href="/applications"
          caption={last24 ? `${last24} in the last 24 hours` : "None in the last 24 hours"} />
        <Stat label="Waiting for vendor" value={apps ? waiting.length : undefined} href="/applications?status=awaiting_vendor" tone="warn" bar={share(waiting.length)}
          caption={oldestWaiting ? `Oldest: ${ago(oldestWaiting.updated_at).replace(" ago", "")}` : "Nobody waiting"} />
        <Stat label="Needs attention" value={apps ? attention.length : undefined} href="/review" tone="serious" bar={share(attention.length)} attention={attention.length > 0}
          caption={attention.length ? `${attention.filter(isHighRisk).length} higher risk` : "All clear"} />
        <Stat label="Approved" value={apps ? count("approved") : undefined} href="/applications?status=approved" tone="good" bar={share(count("approved"))}
          caption={decided.length ? `${approvedPct}% of decided` : "None yet"} />
        <Stat label="Rejected" value={apps ? rejected.length : undefined} href="/applications?status=rejected" tone="critical" bar={share(rejected.length)}
          caption={rejected.length ? `${fraud} fraud risk` : "None"} />
        <Stat label="Decided automatically" value={apps ? `${autoPct}%` : undefined} tone="brand" bar={autoPct}
          caption={decided.length ? `${auto} of ${decided.length} vendors` : "No decisions yet"} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Needs attention"
              subtitle="Longest waiting first"
              right={attention.length > 0 && <Link href="/review" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>}
            />
            {!apps ? <ListSkeleton /> : attention.length === 0 ? (
              <Empty title="All clear">Cases appear here when documents disagree, something looks risky, or a supplier stops replying.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {attention.slice(0, 6).map((a) => {
                  const silent = isUnresponsive(a);
                  const titles = [...new Set((a.reasons ?? []).map((r) => issueTitle(r.code)))];
                  return (
                    <Row key={a.id} href={`/applications/${a.id}`} name={a.legal_name} sub={a.id}
                      detail={silent ? "No reply after every reminder" : titles[0] ?? "Needs review"} more={silent ? 0 : titles.length - 1} when={ago(a.updated_at)} />
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Waiting for vendors" subtitle="Requested automatically and reminded until they reply" />
            {!apps ? <ListSkeleton rows={2} /> : waiting.length === 0 ? (
              <Empty title="Nobody to chase">Vendors with missing documents are emailed and reminded automatically.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {waiting.slice(0, 6).map((a) => {
                  const asks = (a.requested_items ?? []).map((i) => i.title);
                  return (
                    <Row key={a.id} href={`/applications/${a.id}`} name={a.legal_name} sub={a.id}
                      detail={asks[0] ?? "Waiting for the vendor"} more={asks.length - 1} when={ago(a.updated_at)} />
                  );
                })}
              </ul>
            )}
          </Card>

          <Workflow />
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Where applications come from" subtitle={stats ? `${stats.sources.reduce((t, s) => t + s.n, 0)} applications` : undefined} />
            <div className="px-4 py-4">{!stats ? <Skeleton className="h-32" /> : <ChannelDonut sources={stats.sources} />}</div>
          </Card>
          <Card>
            <CardHeader title="Problems caught most often" />
            <div className="px-4 py-4">{!stats ? <Skeleton className="h-28" /> : stats.topIssues.length === 0 ? <p className="text-[13px] text-ink-3">None yet.</p> : <IssueBars issues={stats.topIssues} />}</div>
          </Card>
          <Card>
            <CardHeader title="Recent activity" right={<Link href="/applications?view=activity" className="text-[13px] font-medium text-brand hover:underline">Activity log</Link>} />
            <ul className="divide-y divide-line">
              {(stats?.activity ?? []).slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link href={`/applications/${a.application_id}`} className="flex items-baseline justify-between gap-3 px-4 py-2 transition-colors duration-150 hover:bg-line-2">
                    <span className="min-w-0 truncate text-[13px] text-ink"><span className="text-ink-2">{eventLabel(a.action)}</span> {a.legal_name}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{ago(a.ts)}</span>
                  </Link>
                </li>
              ))}
              {!stats && <li className="p-4"><Skeleton className="h-16" /></li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

const STEPS: { title: string; by: string; tone: "brand" | "neutral" | "info"; text: string }[] = [
  { title: "Application arrives", by: "System", tone: "neutral", text: "Through the supplier portal, an email with attachments, or the Google Form. Documents are stored privately and a run starts at once." },
  { title: "Documents are classified and read", by: "AI", tone: "brand", text: "Each upload is identified (GST certificate, PAN, cheque and so on) and its fields are read with a quote, a confidence and a location. If one model is busy, the next takes over." },
  { title: "Identifiers are validated", by: "Rules", tone: "neutral", text: "PAN, GSTIN with its check digit, IFSC, CIN, Udyam and phone numbers are checked against their official structure, in code and never by AI." },
  { title: "Everything is cross-checked", by: "Rules and live lookups", tone: "info", text: "Form against documents, GSTIN against PAN, names and states, the bank from the IFSC directory and the pincode from India Post." },
  { title: "Risk and duplicates", by: "Rules", tone: "neutral", text: "A bank account used by another vendor, an existing PAN or GSTIN, documents edited in image software, and the sender's email authenticity." },
  { title: "Decision by written policy", by: "Rules", tone: "neutral", text: "Four rules are applied top to bottom and the first match decides. The reason and the evidence are recorded." },
] as const;

const OUTCOMES: { status: "approved" | "awaiting_vendor" | "in_review" | "rejected"; text: string }[] = [
  { status: "approved", text: "ERP vendor record, conditions attached, supplier notified." },
  { status: "awaiting_vendor", text: "Supplier emailed what is missing, then reminded." },
  { status: "in_review", text: "A person decides, with the evidence laid out." },
  { status: "rejected", text: "A person tells the supplier, with the reason." },
];

/** The whole journey of an application, from arrival to outcome, in the order it happens. */
function Workflow() {
  return (
    <Card>
      <CardHeader title="How an application is processed" subtitle="From the moment details and documents arrive to the outcome" />
      <ol className="px-4 py-4">
        {STEPS.map((st, i) => (
          <li key={st.title} className="relative flex gap-3 pb-4">
            {i < STEPS.length && <span aria-hidden className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px bg-line-strong" />}
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-[12px] font-semibold tabular-nums text-ink-2">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-semibold leading-6 text-ink">{st.title}</h3>
                <Badge tone={st.tone}>{st.by}</Badge>
              </div>
              <p className="text-[13px] leading-5 text-ink-2">{st.text}</p>
            </div>
          </li>
        ))}
        <li className="relative flex gap-3">
          <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action text-[12px] font-semibold tabular-nums text-white">{STEPS.length + 1}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-6 text-ink">One of four outcomes</h3>
            <ul className="mt-1 divide-y divide-line border border-line">
              {OUTCOMES.map((o) => (
                <li key={o.status} className="grid gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[150px_1fr] sm:items-center">
                  <span><StatusPill status={o.status} /></span>
                  <span className="text-[13px] leading-5 text-ink-2">{o.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      </ol>
    </Card>
  );
}

const BAR: Record<string, string> = {
  warn: "bg-warn", serious: "bg-serious", good: "bg-good", critical: "bg-critical", brand: "bg-action",
};

/** A count with its meaning (caption) and, where it is a share of something, a thin bar. */
function Stat({ label, value, href, caption, tone, bar, attention }: {
  label: string; value?: number | string; href?: string; caption: string; tone?: keyof typeof BAR; bar?: number; attention?: boolean;
}) {
  const body = (
    <>
      <div className="text-[12px] leading-4 text-ink-2">{label}</div>
      {value === undefined ? <Skeleton className="mt-1.5 h-7 w-12" /> : (
        <div className={cx("mt-0.5 text-[24px] font-semibold leading-8 tabular-nums tracking-[-0.01em]", attention ? "text-serious-ink" : "text-ink")}>{value}</div>
      )}
      <div className="mt-0.5 truncate text-[12px] leading-4 text-ink-3">{caption}</div>
      {bar !== undefined && tone && (
        <div className="mt-2.5 h-1 w-full bg-line" role="img" aria-label={`${bar}%`}>
          <div className={cx("h-full", BAR[tone])} style={{ width: `${Math.max(bar, bar > 0 ? 4 : 0)}%` }} />
        </div>
      )}
    </>
  );
  const cls = "block px-4 py-3";
  return href
    ? <Link href={href} className={cx(cls, "transition-colors duration-150 hover:bg-line-2")}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

function Row({ href, name, sub, detail, more, when }: { href: string; name: string; sub: string; detail: string; more: number; when: string }) {
  return (
    <li>
      <Link href={href} className="grid grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 transition-colors duration-150 hover:bg-line-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_16px] sm:gap-4">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-ink">{name}</span>
          <span className="block font-mono text-[12px] text-ink-3">{sub}</span>
        </span>
        <span className="order-last col-span-3 min-w-0 truncate text-[13px] text-ink-2 sm:order-none sm:col-span-1">
          {detail}{more > 0 && <span className="text-ink-3"> +{more} more</span>}
        </span>
        <span className="whitespace-nowrap text-[12px] text-ink-3">{when}</span>
        <ChevronRight className="h-4 w-4 text-ink-3" />
      </Link>
    </li>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-px">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-[53px] rounded-none" />)}</div>;
}

const R = 46, STROKE = 12, C = 2 * Math.PI * R, GAP = 2;

/** Applications by channel: a thin ring with the total in the middle; hover a segment or a row to focus it. */
function ChannelDonut({ sources }: { sources: Stats["sources"] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rows = CHANNELS.map((c) => ({ ...c, n: sources.find((s) => s.source === c.key)?.n ?? 0 }));
  const total = rows.reduce((t, r) => t + r.n, 0);
  if (!total) return <p className="text-[13px] text-ink-3">No applications yet.</p>;
  const live = rows.filter((r) => r.n > 0);
  const arcs = live.map((r, i) => {
    const before = live.slice(0, i).reduce((t, p) => t + (p.n / total) * C, 0);
    return { ...r, dash: Math.max((r.n / total) * C - (live.length > 1 ? GAP : 0), 0.5), offset: before };
  });
  const focus = rows.find((r) => r.key === hover);
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[128px] w-[128px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`Applications by channel: ${rows.map((r) => `${r.label} ${r.n}`).join(", ")}`}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth={STROKE} />
          {arcs.map((a) => (
            <circle
              key={a.key} cx="60" cy="60" r={R} fill="none" stroke={a.color} strokeWidth={STROKE}
              strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={-a.offset}
              opacity={hover && hover !== a.key ? 0.35 : 1}
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHover(a.key)} onMouseLeave={() => setHover(null)}
            >
              <title>{`${a.label}: ${a.n} (${Math.round((a.n / total) * 100)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-semibold leading-7 tabular-nums text-ink">{focus ? focus.n : total}</span>
          <span className="text-[12px] text-ink-3">{focus ? focus.label : "applications"}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {rows.map((r) => (
          <li key={r.key} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)} className={cx("flex items-center gap-2.5 text-[13px] transition-opacity duration-150", hover && hover !== r.key && "opacity-50")}>
            <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: r.color }} aria-hidden />
            <span className="flex-1 truncate text-ink-2">{r.label}</span>
            <span className="font-semibold tabular-nums text-ink">{r.n}</span>
            <span className="w-9 text-right tabular-nums text-ink-3">{Math.round((r.n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IssueBars({ issues: raw }: { issues: Stats["topIssues"] }) {
  // Different checks can share a plain-language title: count them as one problem.
  const merged = new Map<string, { title: string; n: number }>();
  for (const i of raw) {
    const title = issueTitle(i.code, i.label);
    merged.set(title, { title, n: (merged.get(title)?.n ?? 0) + i.n });
  }
  const issues = [...merged.values()].sort((a, b) => b.n - a.n).slice(0, 5);
  const max = Math.max(...issues.map((i) => i.n));
  return (
    <ul className="space-y-3">
      {issues.map((i) => (
        <li key={i.title} title={`${i.title}: ${i.n}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{i.title}</span>
            <span className="font-semibold tabular-nums text-ink">{i.n}</span>
          </div>
          <div className="h-1.5 w-full bg-line"><div className="h-full bg-seq" style={{ width: `${(i.n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
