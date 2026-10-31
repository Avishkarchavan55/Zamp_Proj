"use client";

import { ArrowRight, ChevronRight, FileSpreadsheet, Globe, Mail, Plus, QrCode } from "@/components/icons";
import Link from "next/link";
import useSWR from "swr";
import type { AppListRow, AuditRow } from "@/components/api-types";
import { Button, Card, CardHeader, Empty, PageHeader, Skeleton, ago, cx } from "@/components/ui";
import { ACTION_LABEL, issueTitle } from "@/lib/ui-meta";

interface Stats {
  runs: { total: number; avg_ms: number; auto: number };
  topIssues: { code: string; label: string; n: number }[];
  activity: AuditRow[];
  comms: { total: number; sent: number; reminders: number };
  timeSaved: { saved_minutes: number; assumptions: { reviewPerApplication: number; perVendorEmail: number } };
  sources: { source: string; n: number }[];
}

const CHANNELS = [
  { key: "portal", label: "Portal", color: "var(--color-ch-portal)", icon: Globe },
  { key: "email", label: "Email", color: "var(--color-ch-email)", icon: Mail },
  { key: "google_form", label: "Google Form", color: "var(--color-ch-form)", icon: FileSpreadsheet },
] as const;

export default function Overview() {
  const { data: stats } = useSWR<Stats>("/api/stats", { refreshInterval: 5000 });
  const { data: apps } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 5000 });
  const { data: sys } = useSWR<{ intake_email: string | null }>("/api/system");

  const count = (s: AppListRow["status"]) => apps?.filter((a) => a.status === s).length ?? 0;
  const decided = apps?.filter((a) => a.status !== "processing") ?? [];
  const auto = decided.filter((a) => a.status !== "in_review" && (a.decided_by === "policy_engine" || !a.decided_by)).length;
  const autoPct = decided.length ? Math.round((auto / decided.length) * 100) : null;
  // Longest-waiting first: that is the order a person should work the queue in.
  const review = (apps ?? []).filter((a) => a.status === "in_review").sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const waiting = (apps ?? []).filter((a) => a.status === "awaiting_vendor");

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={
          !apps ? " " : review.length
            ? <><span className="font-medium text-ink">{review.length} vendor{review.length === 1 ? "" : "s"} need{review.length === 1 ? "s" : ""} your decision.</span> Everything else is handled automatically.</>
            : "Nothing needs your decision right now. Everything is handled automatically."
        }
        right={
          <>
            <Link href="/share"><Button variant="secondary"><QrCode className="h-4 w-4" />Invite a supplier</Button></Link>
            <Link href="/apply" target="_blank"><Button><Plus className="h-4 w-4" />New application</Button></Link>
          </>
        }
      />

      {/* One strip, not six tiles: the counts are links into the lists they describe. */}
      <Card className="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-7 [&>*]:border-line [&>*]:max-lg:border-b [&>*:not(:last-child)]:lg:border-r">
        <Stat label="Applied" value={apps?.length} href="/applications" />
        <Stat label="Waiting for vendor" value={apps ? count("awaiting_vendor") : undefined} href="/applications?status=awaiting_vendor" />
        <Stat label="Needs your decision" value={apps ? count("in_review") : undefined} href="/review" attention={count("in_review") > 0} />
        <Stat label="Approved" value={apps ? count("approved") : undefined} href="/applications?status=approved" />
        <Stat label="Rejected" value={apps ? count("rejected") : undefined} href="/applications?status=rejected" />
        <Stat label="Decided automatically" value={autoPct == null ? undefined : `${autoPct}%`} loading={!apps} />
        <Stat label="Average time to decide" value={stats ? `${(stats.runs.avg_ms / 1000).toFixed(1)} s` : undefined} note="about 35 min by hand" />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Needs your decision"
              subtitle="Longest waiting first"
              right={review.length > 0 && <Link href="/review" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>}
            />
            {!apps ? <ListSkeleton /> : review.length === 0 ? (
              <Empty title="All clear">New cases appear here when documents disagree or something looks risky.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {review.slice(0, 6).map((a) => {
                  const titles = [...new Set((a.reasons ?? []).map((r) => issueTitle(r.code)))];
                  return (
                    <Row key={a.id} href={`/applications/${a.id}`} name={a.legal_name} sub={a.id}
                      detail={titles[0] ?? "Needs review"} more={titles.length - 1} when={ago(a.updated_at)} />
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
                      detail={asks[0] ?? "Waiting for the vendor"} more={asks.length - 1} when={ago(a.updated_at)}
                      flag={a.flags?.includes("vendor_unresponsive") ? "No reply" : undefined} />
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="How vendors applied" subtitle={stats ? `${stats.sources.reduce((t, s) => t + s.n, 0)} applications` : undefined} />
            <div className="px-4 py-4">{!stats ? <Skeleton className="h-16" /> : <ChannelMix sources={stats.sources} />}</div>
          </Card>
          <Card>
            <CardHeader title="Problems caught most often" />
            <div className="px-4 py-4">{!stats ? <Skeleton className="h-28" /> : stats.topIssues.length === 0 ? <p className="text-[13px] text-ink-3">None yet.</p> : <IssueBars issues={stats.topIssues} />}</div>
          </Card>
          <Card>
            <CardHeader title="Recent activity" />
            <ul className="divide-y divide-line">
              {(stats?.activity ?? []).slice(0, 7).map((a) => (
                <li key={a.id}>
                  <Link href={`/applications/${a.application_id}`} className="flex items-baseline justify-between gap-3 px-4 py-2 transition-colors duration-150 hover:bg-line-2">
                    <span className="min-w-0 truncate text-[13px] text-ink"><span className="text-ink-2">{ACTION_LABEL[a.action] ?? a.action}</span> {a.legal_name}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{ago(a.ts)}</span>
                  </Link>
                </li>
              ))}
              {!stats && <li className="p-4"><Skeleton className="h-16" /></li>}
            </ul>
          </Card>
        </div>
      </div>

      <Channels sources={stats?.sources} inbox={sys?.intake_email ?? null} />
    </div>
  );
}

function Stat({ label, value, href, note, attention, loading }: {
  label: string; value?: number | string; href?: string; note?: string; attention?: boolean; loading?: boolean;
}) {
  const body = (
    <>
      <div className="text-[12px] leading-4 text-ink-2">{label}</div>
      {value === undefined || loading ? <Skeleton className="mt-1.5 h-7 w-12" /> : (
        <div className={cx("mt-0.5 text-[24px] font-semibold leading-8 tabular-nums tracking-[-0.01em]", attention ? "text-serious-ink" : "text-ink")}>{value}</div>
      )}
      {note && <div className="text-[12px] leading-4 text-ink-3">{note}</div>}
    </>
  );
  const cls = "block px-4 py-3";
  return href
    ? <Link href={href} className={cx(cls, "transition-colors duration-150 hover:bg-line-2")}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

function Row({ href, name, sub, detail, more, when, flag }: { href: string; name: string; sub: string; detail: string; more: number; when: string; flag?: string }) {
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
        <span className="flex items-center gap-2 whitespace-nowrap text-[12px] text-ink-3">
          {flag && <span className="rounded-full bg-critical-soft px-2 py-0.5 font-medium text-critical-ink">{flag}</span>}
          {when}
        </span>
        <ChevronRight className="h-4 w-4 text-ink-3" />
      </Link>
    </li>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-px">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-[53px] rounded-none" />)}</div>;
}

/** Share of applications per channel: one bar, direct values underneath (colour is never the only cue). */
function ChannelMix({ sources }: { sources: Stats["sources"] }) {
  const rows = CHANNELS.map((c) => ({ ...c, n: sources.find((s) => s.source === c.key)?.n ?? 0 }));
  const total = rows.reduce((t, r) => t + r.n, 0);
  if (!total) return <p className="text-[13px] text-ink-3">No applications yet.</p>;
  return (
    <div>
      <div className="flex h-2 gap-0.5" role="img" aria-label={rows.map((r) => `${r.label} ${r.n}`).join(", ")}>
        {rows.filter((r) => r.n > 0).map((r) => (
          <div key={r.key} title={`${r.label}: ${r.n}`} style={{ width: `${(r.n / total) * 100}%`, background: r.color }} className="rounded-[1px]" />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: r.color }} aria-hidden />
            <span className="flex-1 text-ink-2">{r.label}</span>
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

const GOOGLE_FORM_URL = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL;

function Channels({ sources, inbox }: { sources: Stats["sources"] | undefined; inbox: string | null }) {
  const n = (k: string) => sources?.find((s) => s.source === k)?.n;
  const ways = [
    {
      key: "portal", title: "Vendor portal", who: "Best for most vendors",
      steps: ["The vendor fills in the online form and uploads documents.", "A captcha keeps bots out.", "Checks start as soon as they submit."],
      link: { href: "/apply", label: "Open the portal" },
    },
    {
      key: "email", title: "Email", who: "For vendors who just send documents",
      steps: [inbox ? `The vendor emails documents to ${inbox}.` : "The vendor emails documents to the onboarding inbox.", "AI sorts the attachments and fills in the application.", "The vendor gets a link to confirm the details and add anything missing."],
      link: null,
    },
    {
      key: "google_form", title: "Google Form", who: "For vendors used to Google Forms",
      steps: ["The vendor fills in the form and uploads documents (Google sign-in).", "A Google script forwards the answers and files here.", "The same checks as the portal."],
      link: GOOGLE_FORM_URL ? { href: GOOGLE_FORM_URL, label: "Open the form" } : null,
    },
  ] as const;
  return (
    <Card className="mt-6">
      <CardHeader
        title="How vendors apply"
        subtitle="Three ways in, one process: every application gets the same checks, decision rules and audit trail."
        right={<Link href="/share" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">Invite a supplier <ArrowRight className="h-3.5 w-3.5" /></Link>}
      />
      <div className="grid divide-line md:grid-cols-3 md:divide-x max-md:divide-y">
        {ways.map((w) => {
          const ch = CHANNELS.find((c) => c.key === w.key)!;
          return (
            <div key={w.key} className="flex flex-col p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <ch.icon className="h-4 w-4 text-ink-2" />{w.title}
                </span>
                <span className="text-[12px] text-ink-3"><span className="font-semibold tabular-nums text-ink">{n(w.key) ?? "-"}</span> applied</span>
              </div>
              <div className="text-[12px] text-ink-3">{w.who}</div>
              <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[13px] leading-5 text-ink-2 marker:text-ink-3">
                {w.steps.map((step) => <li key={step} className="break-words pl-1">{step}</li>)}
              </ol>
              {w.link && (
                <a href={w.link.href} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline">
                  {w.link.label} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
