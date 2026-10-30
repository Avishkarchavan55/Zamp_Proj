"use client";

import {
  ArrowRight, Ban, CheckCircle2, ChevronRight, Clock3, ExternalLink, FileSpreadsheet, Globe, Hourglass, Inbox,
  Loader2, Mail, Plus, ScanSearch, TimerReset, TriangleAlert, Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { AppListRow, AuditRow } from "@/components/api-types";
import { useMe } from "@/components/shell";
import { Button, Card, CardHeader, Empty, Skeleton, ago, cx } from "@/components/ui";
import { ACTION_LABEL, issueTitle } from "@/lib/ui-meta";

interface Stats {
  runs: { total: number; avg_ms: number; auto: number };
  topIssues: { code: string; label: string; n: number }[];
  activity: AuditRow[];
  comms: { total: number; sent: number; reminders: number };
  timeSaved: { saved_minutes: number; assumptions: { reviewPerApplication: number; perVendorEmail: number } };
  sources: { source: string; n: number }[];
}

export default function Overview() {
  const { data: stats } = useSWR<Stats>("/api/stats", { refreshInterval: 5000 });
  const { data: apps } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 5000 });
  const { data: me } = useMe();
  const { data: sys } = useSWR<{ intake_email: string | null }>("/api/system");

  const count = (s: AppListRow["status"]) => apps?.filter((a) => a.status === s).length ?? 0;
  const decided = apps?.filter((a) => a.status !== "processing") ?? [];
  const auto = decided.filter((a) => a.status !== "in_review" && (a.decided_by === "policy_engine" || !a.decided_by)).length;
  const autoPct = decided.length ? Math.round((auto / decided.length) * 100) : 0;
  const review = apps?.filter((a) => a.status === "in_review") ?? [];
  const waiting = apps?.filter((a) => a.status === "awaiting_vendor") ?? [];
  const hour = new Date().getHours();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">
            {review.length ? <><span className="font-medium text-ink">{review.length} vendor{review.length === 1 ? "" : "s"} need your decision.</span> Everything else is handled automatically.</> : "Nothing needs your decision right now — everything is handled automatically."}
          </p>
        </div>
        <Link href="/apply" target="_blank"><Button><Plus className="h-4 w-4" />New vendor application</Button></Link>
      </div>

      {/* The process, with live counts — explains the system at a glance. */}
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Where every vendor stands</h2>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6">
          <FlowStep icon={Inbox} title="Applied" value={apps?.length} hint={stats ? stats.sources.map((s) => `${s.n} ${({ portal: "portal", email: "email", google_form: "form" } as Record<string, string>)[s.source] ?? s.source}`).join(" · ") : ""} href="/applications" />
          <FlowStep icon={ScanSearch} title="Checked" value={apps ? apps.length - count("processing") : undefined} hint={stats ? `~${(stats.runs.avg_ms / 1000).toFixed(0)}s each, 40+ checks` : ""} href="/applications" />
          <FlowStep icon={Clock3} tone="warn" title="Waiting for vendor" value={apps ? count("awaiting_vendor") : undefined} hint="Chased automatically" href="/applications?status=awaiting_vendor" />
          <FlowStep icon={TriangleAlert} tone="serious" title="Your decision" value={apps ? count("in_review") : undefined} hint="Documents disagree" href="/review" highlight={count("in_review") > 0} />
          <FlowStep icon={CheckCircle2} tone="good" title="Approved" value={apps ? count("approved") : undefined} hint="Ready for the ERP" href="/applications?status=approved" />
          <FlowStep icon={Ban} tone="critical" title="Rejected" value={apps ? count("rejected") : undefined} hint="No payments" href="/applications?status=rejected" last />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Zap} label="Decided without a person" value={apps ? `${autoPct}%` : null} />
        <Kpi icon={TimerReset} label="Time to decision" value={stats ? `${(stats.runs.avg_ms / 1000).toFixed(1)}s` : null} sub="vs ~35 min by hand" />
        <Kpi icon={Hourglass} label="Manual work saved" value={stats ? `${(stats.timeSaved.saved_minutes / 60).toFixed(1)} h` : null} sub={stats ? `at ${stats.timeSaved.assumptions.reviewPerApplication} min per manual review` : undefined} />
        <Kpi icon={Mail} label="Vendor emails sent for you" value={stats ? String(stats.comms.total) : null} sub={stats?.comms.reminders ? `${stats.comms.reminders} reminders` : undefined} />
      </section>

      {/* At a glance: where applications come from, how they end, what goes wrong. */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="How vendors applied" subtitle="All applications, by channel" />
          <div className="px-5 py-5">{!stats ? <Skeleton className="h-40" /> : <ChannelDonut sources={stats.sources} />}</div>
        </Card>
        <Card>
          <CardHeader title="Outcomes so far" subtitle="Share of decided vendors approved" />
          <div className="px-5 py-5">{!apps ? <Skeleton className="h-40" /> : <OutcomeRing apps={apps} />}</div>
        </Card>
        <Card>
          <CardHeader title="Problems caught most often" />
          <div className="px-5 py-5">{!stats ? <Skeleton className="h-40" /> : stats.topIssues.length === 0 ? <Empty title="None yet" /> : <IssueBars issues={stats.topIssues} />}</div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Needs your decision" right={review.length > 0 && <Link href="/review" className="flex items-center gap-1 text-[13.5px] font-medium text-brand">Open queue <ArrowRight className="h-4 w-4" /></Link>} />
          {!apps ? <div className="space-y-2 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : review.length === 0 ? (
            <Empty icon={CheckCircle2} title="All clear">No vendor needs a human decision.</Empty>
          ) : (
            <VendorList rows={review} />
          )}
        </Card>
        <Card>
          <CardHeader title="Waiting for vendors" subtitle="n8n reminds them automatically" />
          {!apps ? <div className="space-y-2 p-5"><Skeleton className="h-12" /></div> : waiting.length === 0 ? (
            <Empty icon={CheckCircle2} title="Nobody to chase" />
          ) : (
            <VendorList rows={waiting} />
          )}
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="max-h-[300px] divide-y divide-line-2 overflow-y-auto">
            {(stats?.activity ?? []).slice(0, 8).map((a) => (
              <li key={a.id}>
                <Link href={`/applications/${a.application_id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-line-2/60">
                  <span className="min-w-0 truncate text-[14px] text-ink"><span className="text-ink-2">{ACTION_LABEL[a.action] ?? a.action} · </span>{a.legal_name}</span>
                  <span className="shrink-0 text-[12.5px] text-ink-3">{ago(a.ts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Channels sources={stats?.sources} inbox={sys?.intake_email ?? null} />
    </div>
  );
}

// ---- Channels -------------------------------------------------------------------------------------

const GOOGLE_FORM_URL = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL;

const CHANNELS = [
  { key: "portal", label: "Portal", color: "var(--color-ch-portal)" },
  { key: "email", label: "Email", color: "var(--color-ch-email)" },
  { key: "google_form", label: "Google Form", color: "var(--color-ch-form)" },
] as const;

function Channels({ sources, inbox }: { sources: Stats["sources"] | undefined; inbox: string | null }) {
  const n = (k: string) => sources?.find((s) => s.source === k)?.n ?? 0;
  const ways = [
    {
      key: "portal", icon: Globe, title: "Vendor portal", who: "Best for most vendors",
      steps: ["Vendor fills the online form and uploads documents", "A captcha keeps bots out", "Checks start the moment they submit"],
      link: { href: "/apply", label: "Open the portal" },
    },
    {
      key: "email", icon: Mail, title: "Email", who: "For vendors who just send documents",
      steps: [inbox ? `Vendor emails documents to ${inbox}` : "Vendor emails documents to the onboarding inbox", "AI sorts the attachments and fills in the application", "Vendor gets a link to confirm the details and add anything missing"],
      link: null,
    },
    {
      key: "google_form", icon: FileSpreadsheet, title: "Google Form", who: "For vendors used to Google Forms",
      steps: ["Vendor fills the form and uploads documents (Google sign-in)", "A Google script forwards the answers and files here", "Same checks as the portal"],
      link: GOOGLE_FORM_URL ? { href: GOOGLE_FORM_URL, label: "Open the form" } : null,
    },
  ] as const;
  return (
    <section>
      <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">How vendors apply</h2>
      <p className="mb-3 text-[14px] text-ink-2">Three ways in, one process: every application gets the same checks, decision rules and audit trail.</p>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
        {ways.map((w) => {
          const ch = CHANNELS.find((c) => c.key === w.key)!;
          return (
            <div key={w.key} className="flex flex-col bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: ch.color }} aria-hidden />
                  <w.icon className="h-4 w-4 text-ink-3" />{w.title}
                </span>
                <span className="text-[13px] text-ink-2"><span className="font-semibold text-ink">{sources ? n(w.key) : "–"}</span> applied</span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-ink-3">{w.who}</div>
              <ol className="mt-3 space-y-1.5">
                {w.steps.map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-line-2 text-[11px] font-semibold text-ink-2">{i + 1}</span>
                    <span className="break-words">{step}</span>
                  </li>
                ))}
              </ol>
              {w.link && (
                <a href={w.link.href} target="_blank" rel="noreferrer" className="mt-auto flex items-center gap-1.5 pt-4 text-[13.5px] font-medium text-brand hover:text-brand-2">
                  {w.link.label} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Charts ---------------------------------------------------------------------------------------

const R = 52, STROKE = 14, C = 2 * Math.PI * R, GAP = 2;

/** Hollow donut: segments separated by a 2px surface gap; hovering a segment or legend row focuses it. */
function ChannelDonut({ sources }: { sources: Stats["sources"] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rows = CHANNELS.map((c) => ({ ...c, n: sources.find((s) => s.source === c.key)?.n ?? 0 }));
  const total = rows.reduce((t, r) => t + r.n, 0);
  if (!total) return <Empty title="No applications yet" />;
  const live = rows.filter((r) => r.n > 0);
  // Each arc starts where the previous ones end.
  const arcs = live.map((r, i) => {
    const offset = live.slice(0, i).reduce((t, p) => t + (p.n / total) * C, 0);
    return { ...r, dash: Math.max((r.n / total) * C - (live.length > 1 ? GAP : 0), 0.5), offset };
  });
  const focus = rows.find((r) => r.key === hover);
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[136px] w-[136px] shrink-0">
        <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90" role="img" aria-label={`Applications by channel: ${rows.map((r) => `${r.label} ${r.n}`).join(", ")}`}>
          <circle cx="68" cy="68" r={R} fill="none" stroke="var(--color-line-2)" strokeWidth={STROKE} />
          {arcs.map((a) => (
            <circle
              key={a.key} cx="68" cy="68" r={R} fill="none" stroke={a.color} strokeWidth={hover === a.key ? STROKE + 4 : STROKE}
              strokeDasharray={`${a.dash} ${C - a.dash}`} strokeDashoffset={-a.offset}
              opacity={hover && hover !== a.key ? 0.35 : 1}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHover(a.key)} onMouseLeave={() => setHover(null)}
            >
              <title>{`${a.label}: ${a.n} (${Math.round((a.n / total) * 100)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-semibold leading-none text-ink">{focus ? focus.n : total}</span>
          <span className="mt-1 text-[12px] text-ink-3">{focus ? focus.label : "applications"}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {rows.map((r) => (
          <li key={r.key} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)} className={cx("flex items-center gap-2.5 rounded-md text-[13.5px] transition-opacity", hover && hover !== r.key && "opacity-50")}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-2">{r.label}</span>
            <span className="font-semibold tabular-nums text-ink">{r.n}</span>
            <span className="w-10 text-right tabular-nums text-ink-3">{Math.round((r.n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-series ring (approval rate) + an icon-and-label breakdown, so no state relies on colour alone. */
function OutcomeRing({ apps }: { apps: AppListRow[] }) {
  const n = (s: AppListRow["status"]) => apps.filter((a) => a.status === s).length;
  const rows = [
    { icon: CheckCircle2, tone: "text-good-ink", label: "Approved", n: n("approved") },
    { icon: Clock3, tone: "text-warn-ink", label: "Waiting for vendor", n: n("awaiting_vendor") },
    { icon: TriangleAlert, tone: "text-serious-ink", label: "Your decision", n: n("in_review") },
    { icon: Ban, tone: "text-critical-ink", label: "Rejected", n: n("rejected") },
    { icon: Loader2, tone: "text-ink-3", label: "Being checked", n: n("processing") },
  ].filter((r) => r.n > 0 || r.label !== "Being checked");
  const decided = n("approved") + n("rejected");
  const pct = decided ? Math.round((n("approved") / decided) * 100) : 0;
  const len = (pct / 100) * C;
  if (!apps.length) return <Empty title="No applications yet" />;
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[136px] w-[136px] shrink-0" title={`${n("approved")} approved of ${decided} with a final decision`}>
        <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90" role="img" aria-label={`${pct}% of decided vendors approved`}>
          <circle cx="68" cy="68" r={R} fill="none" stroke="var(--color-good-soft)" strokeWidth={STROKE} />
          {len > 0 && (
            <circle cx="68" cy="68" r={R} fill="none" stroke="var(--color-good)" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={`${len} ${C - len}`} className="transition-all duration-500" />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-semibold leading-none text-ink">{decided ? `${pct}%` : "–"}</span>
          <span className="mt-1 text-[12px] text-ink-3">approved</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2.5 text-[13.5px]">
            <r.icon className={cx("h-4 w-4 shrink-0", r.tone)} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{r.label}</span>
            <span className="font-semibold tabular-nums text-ink">{r.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TONES = {
  neutral: "text-ink-3",
  warn: "text-warn-ink",
  serious: "text-serious-ink",
  good: "text-good-ink",
  critical: "text-critical-ink",
};

function FlowStep({ icon: Icon, title, value, hint, href, tone = "neutral", highlight, last }: {
  icon: React.ElementType; title: string; value: number | undefined; hint?: string; href: string; tone?: keyof typeof TONES; highlight?: boolean; last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group relative flex min-h-[132px] flex-col border-b border-r border-line px-5 py-4 transition-colors duration-150 hover:bg-line-2/60 lg:border-b-0",
        last && "lg:border-r-0",
        highlight && "bg-serious-soft/60 hover:bg-serious-soft",
      )}
    >
      <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink-2"><Icon className={cx("h-4 w-4 shrink-0", TONES[tone])} />{title}</span>
      {value === undefined ? <Skeleton className="mt-3 h-8 w-12" /> : <span className="mt-2 text-[30px] font-semibold leading-none tabular-nums text-ink">{value}</span>}
      {hint && <span className="mt-auto pt-2 text-[12.5px] leading-snug text-ink-3">{hint}</span>}
    </Link>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | null; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4">
      <div className="flex items-center gap-2 text-[13.5px] text-ink-2"><Icon className="h-4 w-4 text-ink-3" />{label}</div>
      {value == null ? <Skeleton className="mt-2 h-8 w-16" /> : <div className="mt-1.5 text-[26px] font-semibold tabular-nums text-ink">{value}</div>}
      {sub && <div className="text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

function VendorList({ rows }: { rows: AppListRow[] }) {
  return (
    <ul className="divide-y divide-line-2">
      {rows.slice(0, 6).map((a) => (
        <li key={a.id}>
          <Link href={`/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-line-2/60">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-medium text-ink">{a.legal_name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[...new Set(a.status === "awaiting_vendor"
                  ? (a.requested_items ?? []).map((i) => i.title)
                  : (a.reasons ?? []).map((r) => issueTitle(r.code)))].slice(0, 3).map((t) => (
                  <span key={t} className={cx("rounded-md px-1.5 py-0.5 text-[12.5px]", a.status === "awaiting_vendor" ? "bg-warn-soft text-warn-ink" : "bg-serious-soft text-serious-ink")}>{t}</span>
                ))}
              </div>
            </div>
            {a.flags?.includes("vendor_unresponsive") && <span className="shrink-0 rounded-md bg-critical-soft px-2 py-0.5 text-[12px] font-medium text-critical-ink">no reply</span>}
            <span className="shrink-0 text-[12.5px] text-ink-3">{ago(a.updated_at)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function IssueBars({ issues: raw }: { issues: Stats["topIssues"] }) {
  // Different checks can share a plain-language title: count them as one problem.
  const merged = new Map<string, { code: string; title: string; n: number }>();
  for (const i of raw) {
    const title = issueTitle(i.code, i.label);
    const cur = merged.get(title);
    merged.set(title, { code: cur?.code ?? i.code, title, n: (cur?.n ?? 0) + i.n });
  }
  const issues = [...merged.values()].sort((a, b) => b.n - a.n);
  const max = Math.max(...issues.map((i) => i.n));
  return (
    <ul className="space-y-3.5">
      {issues.slice(0, 5).map((i) => (
        <li key={i.title} title={`${i.title}: ${i.n}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="truncate text-ink-2">{i.title}</span>
            <span className="font-semibold tabular-nums text-ink">{i.n}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-line-2">
            <div className="h-full rounded-full bg-seq" style={{ width: `${(i.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
