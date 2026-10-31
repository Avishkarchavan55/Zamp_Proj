"use client";

import { ArrowRight, Bell, CheckCircle2, Mail } from "@/components/icons";
import Link from "next/link";
import useSWR from "swr";
import { Badge, Card, CardHeader, Empty, PageHeader, Skeleton, ago, cx, dateTime } from "@/components/ui";

interface PortalApp {
  id: string;
  legal_name: string;
  status: { key: string; label: string; text: string };
  requested: string[];
  update_url: string | null;
  created_at: string;
  updated_at: string;
}
interface Notice {
  id: string; title: string; body: string; link: string | null; created_at: string; read_at: string | null; application_id: string; legal_name: string;
}

const TONE = { approved: "good", action: "warn", team: "info", checking: "neutral" } as const;

/** Four steps every application goes through, and how far each status has got. */
const STEPS = ["Received", "Documents checked", "Team review", "Decision"];
const PROGRESS: Record<string, { done: number; waiting?: boolean }> = {
  checking: { done: 1 }, action: { done: 1, waiting: true }, team: { done: 2 }, approved: { done: 4 },
};

function Steps({ status }: { status: string }) {
  const p = PROGRESS[status] ?? PROGRESS.checking;
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4" aria-label="Application progress">
      {STEPS.map((s, i) => {
        const done = i < p.done;
        const current = i === p.done && p.done < 4;
        return (
          <li key={s}>
            <div className={cx("h-1 w-full", done ? "bg-good" : current ? (p.waiting ? "bg-warn" : "bg-action") : "bg-line")} />
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
              {done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-good" />}
              <span className={cx(done || current ? "font-medium text-ink" : "text-ink-3")}>{s}</span>
            </div>
            {current && <div className="text-[12px] text-ink-3">{p.waiting ? "Waiting for you" : "In progress"}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="border-l border-line px-4 py-3 first:border-l-0">
      <div className="text-[12px] text-ink-2">{label}</div>
      <div className="mt-1 text-[28px] font-light leading-8 tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-[12px] text-ink-3">{caption}</div>
    </div>
  );
}

/** The supplier's applications: where each stands, what we are waiting for, and the latest messages. */
export default function SupplierPortal() {
  const { data } = useSWR<{ email: string; applications: PortalApp[]; unread: number }>("/api/supplier/portal", { refreshInterval: 8000 });
  const { data: notices } = useSWR<Notice[]>("/api/supplier/notifications", { refreshInterval: 8000 });

  const apps = data?.applications ?? [];
  const action = apps.filter((a) => a.status.key === "action").length;
  const approved = apps.filter((a) => a.status.key === "approved").length;
  const recent = (notices ?? []).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Supplier portal"
        subtitle="Where your applications with Acme Manufacturing stand, and what we need from you."
        right={<Link href="/portal/become-a-supplier" className="btn inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-line-2">Register another business</Link>}
      />
      {!data ? (
        <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>
      ) : apps.length === 0 ? (
        <Card><Empty title="No applications found">Nothing is registered under {data.email}. <Link href="/portal/become-a-supplier" className="font-medium text-brand hover:underline">Register a business</Link>.</Empty></Card>
      ) : (
        <>
          <Card className="mb-6 grid grid-cols-2 sm:grid-cols-4">
            <Stat label="Applications" value={apps.length} caption="registered under your email" />
            <Stat label="Action needed" value={action} caption={action ? "waiting for you" : "nothing waiting"} />
            <Stat label="Approved" value={approved} caption={approved ? "ready to supply" : "none yet"} />
            <Stat label="Unread notifications" value={data.unread} caption={data.unread ? "open Notifications" : "all caught up"} />
          </Card>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              {apps.map((a) => (
                <Card key={a.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <h2 className="text-[16px] font-semibold leading-6 text-ink">{a.legal_name}</h2>
                      <p className="text-[12px] text-ink-3"><span className="font-mono">{a.id}</span></p>
                    </div>
                    <Badge tone={TONE[a.status.key as keyof typeof TONE] ?? "neutral"} className="h-6 px-3 text-[13px]">{a.status.label}</Badge>
                  </div>
                  <div className="space-y-4 px-5 py-4">
                    <Steps status={a.status.key} />
                    <p className="text-[14px] leading-5 text-ink-2">{a.status.text}</p>
                    {a.requested.length > 0 && (
                      <div className="border border-warn/40 bg-warn-soft px-4 py-3">
                        <div className="text-[13px] font-semibold text-warn-ink">What we need</div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-5 text-ink">
                          {a.requested.map((t) => <li key={t}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {a.update_url && (
                      <Link href={a.update_url} className="btn inline-flex h-10 items-center gap-2 rounded-md bg-action px-4 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-action-2">
                        Update my application <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-px border-t border-line bg-line text-[13px]">
                    <div className="bg-surface px-5 py-3"><dt className="text-[12px] text-ink-3">Submitted</dt><dd className="text-ink">{dateTime(a.created_at)}</dd></div>
                    <div className="bg-surface px-5 py-3"><dt className="text-[12px] text-ink-3">Last updated</dt><dd className="text-ink">{ago(a.updated_at)}</dd></div>
                  </dl>
                </Card>
              ))}
            </div>

            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader title="Latest notifications" right={<Link href="/portal/notifications" className="text-[13px] font-medium text-brand hover:underline">View all</Link>} />
                {!notices ? <Skeleton className="m-4 h-24" /> : recent.length === 0 ? (
                  <Empty icon={Bell} title="Nothing yet">When we email you, a short note appears here too.</Empty>
                ) : (
                  <ul className="divide-y divide-line">
                    {recent.map((n) => (
                      <li key={n.id} className={cx("flex gap-3 px-4 py-3", !n.read_at && "bg-brand-soft")}>
                        <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-[1px]", n.read_at ? "bg-transparent" : "bg-action")} />
                        <span className="min-w-0 flex-1">
                          <span className={cx("block text-[13px] leading-5 text-ink", !n.read_at && "font-semibold")}>{n.title}</span>
                          {n.body && <span className="block truncate text-[12px] text-ink-3">{n.body}</span>}
                          <span className="block text-[12px] text-ink-3">{apps.length > 1 && `${n.legal_name}, `}{ago(n.created_at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader title="What happens next" />
                <ol className="space-y-3 px-4 py-4 text-[13px] leading-5 text-ink-2">
                  <li><span className="font-medium text-ink">1. We check your documents.</span> This takes about a minute.</li>
                  <li><span className="font-medium text-ink">2. If something is missing,</span> we email you and add a note here, with a button to upload it.</li>
                  <li><span className="font-medium text-ink">3. A person reviews anything unclear</span> and contacts you if needed.</li>
                  <li><span className="font-medium text-ink">4. Once approved,</span> you are set up as a supplier.</li>
                </ol>
                <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px] text-ink-3">
                  <Mail className="h-4 w-4 shrink-0" />
                  Questions? Reply to any email we sent you.
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
