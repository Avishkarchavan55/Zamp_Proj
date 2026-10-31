"use client";

import { ArrowRight } from "@/components/icons";
import Link from "next/link";
import useSWR from "swr";
import { Badge, Card, Empty, PageHeader, Skeleton, ago, cx, dateTime } from "@/components/ui";

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
  id: string; title: string; body: string; link: string | null; created_at: string; read_at: string | null; application_id: string;
}

const TONE = { approved: "good", action: "warn", team: "info", checking: "neutral" } as const;

/** The supplier's applications: where each stands, what we are waiting for, and the latest messages. */
export default function SupplierPortal() {
  const { data } = useSWR<{ email: string; applications: PortalApp[]; unread: number }>("/api/supplier/portal", { refreshInterval: 8000 });
  const { data: notices } = useSWR<Notice[]>("/api/supplier/notifications", { refreshInterval: 8000 });

  return (
    <div>
      <PageHeader title="Supplier portal" subtitle="Where your applications with Acme Manufacturing stand." />
      {!data ? (
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : data.applications.length === 0 ? (
        <Card><Empty title="No applications found">Nothing is registered under {data.email}. <Link href="/portal/become-a-supplier" className="font-medium text-brand hover:underline">Register a business</Link>.</Empty></Card>
      ) : (
        <div className="space-y-4">
          {data.applications.map((a) => {
            const latest = (notices ?? []).filter((n) => n.application_id === a.id).slice(0, 3);
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold leading-6 text-ink">{a.legal_name}</h2>
                    <p className="text-[12px] text-ink-3"><span className="font-mono">{a.id}</span>, submitted {dateTime(a.created_at)}</p>
                  </div>
                  <Badge tone={TONE[a.status.key as keyof typeof TONE] ?? "neutral"} className="h-6 px-3 text-[13px]">{a.status.label}</Badge>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[14px] leading-5 text-ink-2">{a.status.text}</p>
                  {a.requested.length > 0 && (
                    <div className="mt-3 border border-warn/40 bg-warn-soft px-4 py-3">
                      <div className="text-[13px] font-semibold text-warn-ink">What we need</div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-5 text-ink">
                        {a.requested.map((t) => <li key={t}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {a.update_url && (
                    <Link href={a.update_url} className="btn mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-action px-4 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-action-2">
                      Update my application <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
                {latest.length > 0 && (
                  <div className="border-t border-line">
                    <h3 className="px-5 pt-3 text-[13px] font-semibold text-ink">Latest updates</h3>
                    <ul className="divide-y divide-line">
                      {latest.map((n) => (
                        <li key={n.id} className="flex items-start justify-between gap-4 px-5 py-2.5">
                          <span className="min-w-0">
                            <span className={cx("block text-[13px] leading-5 text-ink", !n.read_at && "font-medium")}>{n.title}</span>
                            {n.body && <span className="block truncate text-[12px] text-ink-3">{n.body}</span>}
                          </span>
                          <span className="shrink-0 pt-0.5 text-[12px] text-ink-3">{ago(n.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-line px-5 py-2.5">
                      <Link href="/portal/notifications" className="text-[13px] font-medium text-brand hover:underline">All notifications</Link>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
