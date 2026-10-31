"use client";

import {
  AlertTriangle, Bot, CheckCircle2, Circle, Cpu, FileText, Image as ImageIcon, Loader2, Recycle, Terminal, XCircle,
} from "@/components/icons";
import { BackButton } from "@/components/page-nav";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { RunDetail, RunEvent } from "@/components/api-types";
import { Badge, Card, CardHeader, Skeleton, clock, cx, secs } from "@/components/ui";
import { useRealtime } from "@/components/use-realtime";
import { CheckGroups, DecisionPanel } from "@/components/verification";
import { DOC_SLOTS, DOC_TYPE_LABELS } from "@/lib/policy";
import type { DocType, Stage } from "@/lib/types";
import { ENTITY_SHORT, STAGES } from "@/lib/ui-meta";

type RunWithApp = RunDetail & { run: RunDetail["run"] & { legal_name: string; entity_type: string } };

const TRIGGER_LABEL: Record<string, string> = {
  submission: "New submission",
  resubmission: "Vendor resubmission",
  manual_rerun: "Manual re-run",
  confirmation: "Vendor confirmed details",
};

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, mutate } = useSWR<RunWithApp>(`/api/runs/${id}`, {
    // Polling is the safety net; Realtime pushes (when Supabase is configured) refresh instantly.
    refreshInterval: (latest) => (!latest || latest.run.status === "running" ? 800 : 0),
  });
  const running = data?.run.status === "running";
  const refresh = useCallback(() => void mutate(), [mutate]);
  const live = useRealtime(running ? `run:${id}` : null, refresh);

  if (error) return <div className="text-sm text-critical-ink">Could not load run: {String(error.message)}</div>;
  if (!data) return <RunSkeleton />;

  const { run, events, checks, extractions } = data;
  return (
    <div className="space-y-6">
      <div>
        <BackButton fallback={`/applications/${run.application_id}`} className="mb-3" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span className="font-mono">{run.id}</span>·<span>{TRIGGER_LABEL[run.trigger] ?? run.trigger}</span>·<span>started {clock(run.started_at)}</span>
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight">{run.legal_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{ENTITY_SHORT[run.entity_type] ?? run.entity_type}</Badge>
              <Badge tone="brand"><Cpu className="h-3 w-3" />{run.extractor}</Badge>
              {running && <Badge tone={live ? "good" : "neutral"}>{live ? "● Realtime" : "Polling"}</Badge>}
            </div>
          </div>
          <RunClock run={run} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Pipeline run={run} events={events} />
        </div>
        <div className="min-w-0 space-y-6 lg:col-span-8">
          {run.status === "completed" && run.decision ? (
            <DecisionPanel decision={run.decision} />
          ) : run.status === "failed" ? (
            <Card className="border-critical/40 p-5">
              <div className="flex items-center gap-2 font-semibold text-critical-ink"><XCircle className="h-5 w-5" /> Run failed</div>
              <p className="mt-1 text-sm text-ink-2">{run.error}</p>
              <p className="mt-1 text-xs text-ink-3">The application was routed to manual review so nothing is lost.</p>
            </Card>
          ) : (
            <Card className="flex items-center gap-3 border-brand/30 bg-brand-soft/40 px-5 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <div>
                <div className="text-sm font-semibold text-ink">Verifying - {STAGES.find((s) => s.id === run.current_stage)?.label ?? "starting"}</div>
                <div className="text-xs text-ink-2">{STAGES.find((s) => s.id === run.current_stage)?.description}</div>
              </div>
            </Card>
          )}

          <Documents events={events} extractions={extractions} />
          <LiveLog events={events} running={running} />

          <Card>
            <CardHeader title="Checks" subtitle={`${checks.length} checks recorded so far · click any check for its evidence and rule`} />
            {checks.length ? <CheckGroups checks={checks} /> : <div className="px-5 py-8 text-center text-sm text-ink-3">Checks appear here as each stage completes.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RunClock({ run }: { run: RunDetail["run"] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [run.status]);
  const ms = run.duration_ms ?? Math.max(0, now - new Date(run.started_at).getTime());
  return (
    <div className="rounded-md border border-line bg-surface px-4 py-2.5 text-right ">
      <div className="text-[12px] font-medium text-ink-3">{run.status === "running" ? "Elapsed" : "Total time"}</div>
      <div className="font-mono text-xl font-semibold tabular-nums text-ink">{(ms / 1000).toFixed(1)}s</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

type StageState = "pending" | "active" | "success" | "warning" | "error";

function stageStates(run: RunDetail["run"], events: RunEvent[]) {
  const order = STAGES.map((s) => s.id);
  const current = run.current_stage === "done" ? order.length : order.indexOf(run.current_stage as Stage);
  return STAGES.map((s, i) => {
    const evs = events.filter((e) => e.stage === s.id);
    const summary = [...evs].reverse().find((e) => e.data && typeof e.data === "object" && "passed" in e.data);
    const first = evs[0]?.ts;
    const nextFirst = events.find((e) => order.indexOf(e.stage) > i)?.ts;
    const duration = first && nextFirst ? new Date(nextFirst).getTime() - new Date(first).getTime() : null;
    let state: StageState = "pending";
    if (run.status === "failed" && i === current) state = "error";
    else if (i < current || run.status === "completed") {
      const worst = evs.some((e) => e.level === "error") ? "error" : evs.some((e) => e.level === "warning") ? "warning" : "success";
      state = worst;
    } else if (i === current) state = "active";
    const last = evs[evs.length - 1];
    return { ...s, state, summary: summary?.message.split(": ").slice(1).join(": ") || (state === "active" ? last?.message : last?.message), duration, events: evs.length };
  });
}

function Pipeline({ run, events }: { run: RunDetail["run"]; events: RunEvent[] }) {
  const states = useMemo(() => stageStates(run, events), [run, events]);
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader title="Verification steps" subtitle="AI is used only to read documents - rules decide" icon={Bot} />
      <ol className="px-5 py-4">
        {states.map((s, i) => (
          <li key={s.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < states.length - 1 && (
              <span className={cx("absolute left-[13px] top-7 h-[calc(100%-22px)] w-0.5 rounded", s.state === "pending" || s.state === "active" ? "bg-line" : "bg-good/40")} />
            )}
            <StageDot state={s.state} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cx("text-[13px] font-semibold", s.state === "pending" ? "text-ink-3" : "text-ink")}>{s.label}</span>
                {s.duration != null && s.state !== "pending" && s.state !== "active" && (
                  <span className="font-mono text-[12px] text-ink-3">{secs(s.duration)}</span>
                )}
              </div>
              <div className={cx("text-[12px] leading-snug", s.state === "active" ? "text-brand-2" : "text-ink-3")}>
                {s.state === "pending" ? s.description : s.summary ?? s.description}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function StageDot({ state }: { state: StageState }) {
  const base = "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  if (state === "active") return <span className={cx(base, "animate-pulse-ring bg-action text-white")}><Loader2 className="h-3.5 w-3.5 animate-spin" /></span>;
  if (state === "success") return <span className={cx(base, "bg-good-soft text-good-ink ring-1 ring-good/30")}><CheckCircle2 className="h-4 w-4" /></span>;
  if (state === "warning") return <span className={cx(base, "bg-serious-soft text-serious-ink ring-1 ring-serious/30")}><AlertTriangle className="h-4 w-4" /></span>;
  if (state === "error") return <span className={cx(base, "bg-critical-soft text-critical-ink ring-1 ring-critical/30")}><XCircle className="h-4 w-4" /></span>;
  return <span className={cx(base, "bg-line-2 text-ink-3 ring-1 ring-line")}><Circle className="h-3 w-3" /></span>;
}

// ------------------------------------------------------------------------------------------------

function Documents({ events, extractions }: { events: RunEvent[]; extractions: RunDetail["extractions"] }) {
  const started = events.filter((e) => e.stage === "extraction" && e.data && "slot" in e.data && !("detected_type" in e.data));
  const slots = Array.from(new Set(started.map((e) => String(e.data!.slot))));
  if (!slots.length) return null;
  return (
    <Card>
      <CardHeader title="Documents" subtitle="Classified and read by the document AI - wrong documents are caught here" icon={FileText} />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {slots.map((slot) => {
          const ex = extractions.find((x) => x.slot === slot);
          const startEv = started.find((e) => e.data!.slot === slot)!;
          const filename = startEv.message.split(":")[0];
          const meta = DOC_SLOTS[slot as keyof typeof DOC_SLOTS];
          const wrong = ex && !meta.expects.includes(ex.detected_type as DocType);
          const isImg = filename.match(/\.(png|jpe?g|webp)$/i);
          return (
            <div key={slot} className={cx("animate-rise rounded-lg border p-3", wrong ? "border-critical/40 bg-critical-soft/40" : "border-line")}>
              <div className="flex items-start gap-2.5">
                <div className="rounded-md bg-line-2 p-1.5">{isImg ? <ImageIcon className="h-4 w-4 text-ink-2" /> : <FileText className="h-4 w-4 text-ink-2" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-ink-3">{meta.label} slot</div>
                  <div className="truncate text-[13px] font-medium text-ink" title={filename}>{filename}</div>
                </div>
              </div>
              <div className="mt-2.5 text-[12px]">
                {!ex ? (
                  <span className="flex items-center gap-1.5 text-brand-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading document…</span>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={wrong ? "critical" : "good"}>{wrong ? "Wrong document: " : ""}{DOC_TYPE_LABELS[ex.detected_type as DocType]}</Badge>
                      <Badge tone={ex.legibility === "clear" ? "neutral" : "warn"}>{ex.legibility}</Badge>
                      {ex.cached && <Badge tone="info"><Recycle className="h-3 w-3" />unchanged - reused</Badge>}
                    </div>
                    <div className="text-ink-3">
                      {ex.fields.length} fields · {Math.round(ex.type_confidence * 100)}% type confidence{ex.latency_ms ? ` · ${secs(ex.latency_ms)}` : ""}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const LEVEL_COLOR = { info: "text-slate-300", success: "text-emerald-400", warning: "text-amber-300", error: "text-rose-400" };
const LEVEL_MARK = { info: "·", success: "✓", warning: "!", error: "✗" };

function LiveLog({ events, running }: { events: RunEvent[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events.length]);
  return (
    <div className="overflow-hidden rounded-md border border-[#393939] bg-[#161616] ">
      <div className="flex items-center justify-between border-b border-[#393939] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-slate-200"><Terminal className="h-4 w-4 text-slate-400" /> Execution log</div>
        <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
          <span className={cx("h-1.5 w-1.5 rounded-full", running ? "animate-pulse bg-emerald-400" : "bg-slate-500")} />
          {running ? "live" : `${events.length} events`}
        </div>
      </div>
      <div ref={ref} className="scrollbar-thin max-h-72 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-[1.7]">
        {events.map((e) => (
          <div key={e.id} className="animate-rise flex gap-3">
            <span className="shrink-0 text-slate-500">{clock(e.ts)}</span>
            <span className="w-[86px] shrink-0 truncate text-[#78a9ff]">{STAGES.find((s) => s.id === e.stage)?.label ?? e.stage}</span>
            <span className={cx("shrink-0", LEVEL_COLOR[e.level])}>{LEVEL_MARK[e.level]}</span>
            <span className={cx("min-w-0 break-words", e.level === "info" ? "text-slate-300" : LEVEL_COLOR[e.level])}>{e.message}</span>
          </div>
        ))}
        {running && <div className="mt-1 h-3.5 w-2 animate-pulse bg-slate-400" />}
      </div>
    </div>
  );
}

function RunSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[520px] lg:col-span-4" />
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-28" />
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}
