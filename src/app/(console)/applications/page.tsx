"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import type { AppListRow } from "@/components/api-types";
import { Badge, Button, Card, Empty, PageHeader, Skeleton, StatusPill, ago, cx } from "@/components/ui";
import type { AppStatus } from "@/lib/types";
import { ENTITY_SHORT, STATUS_META, rejectionReason } from "@/lib/ui-meta";

const FILTERS: ("all" | AppStatus)[] = ["all", "in_review", "awaiting_vendor", "approved", "rejected", "processing"];

export default function ApplicationsPage() {
  return (
    <Suspense>
      <Applications />
    </Suspense>
  );
}

function Applications() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") as AppStatus | null) ?? "all";
  const [q, setQ] = useState("");
  const { data } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 4000 });

  const rows = (data ?? []).filter(
    (a) =>
      (status === "all" || a.status === status) &&
      (!q || `${a.legal_name} ${a.id} ${a.city} ${a.category}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <PageHeader
        title="All vendors"
        subtitle="Every vendor who applied, and where they stand."
        right={<Link href="/apply" target="_blank"><Button><Plus className="h-4 w-4" />New application</Button></Link>}
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="scrollbar-thin flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => {
              const n = f === "all" ? data?.length : data?.filter((a) => a.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => router.replace(f === "all" ? "/applications" : `/applications?status=${f}`)}
                  className={cx("whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium", status === f ? "bg-ink text-canvas" : "text-ink-2 hover:bg-line-2")}
                >
                  {f === "all" ? "All" : STATUS_META[f].short} {n != null && <span className="ml-1 opacity-60">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, ID, city…" className="input w-full pl-9" />
          </div>
        </div>
        {!data ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <Empty title="No applications match">Try a different filter or search.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="text-left text-[11.5px] uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-3 py-2.5 font-medium">Type · location</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Outstanding</th>
                  <th className="px-3 py-2.5 font-medium">Verification</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => router.push(`/applications/${a.id}`)} className="cursor-pointer border-b border-line-2 last:border-0 hover:bg-line-2/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{a.legal_name}</div>
                      <div className="font-mono text-[11.5px] text-ink-3">{a.id}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{ENTITY_SHORT[a.entity_type]} · {a.city}</td>
                    <td className="px-3 py-3"><StatusPill status={a.status} /></td>
                    <td className="max-w-[280px] px-3 py-3">
                      {a.status === "rejected" ? (() => {
                        const r = rejectionReason(a);
                        return (
                          <div className="flex min-w-0 items-center gap-1.5" title={r.explain}>
                            <span className="shrink-0 rounded-md bg-critical-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-critical-ink">{r.label}</span>
                            <span className="truncate text-[12.5px] text-ink-2">{r.title}</span>
                          </div>
                        );
                      })() : <div className="truncate text-[12.5px] text-ink-2" title={a.headline ?? ""}>{a.status === "approved" ? "—" : a.headline}</div>}
                      {a.flags?.includes("vendor_unresponsive") && <Badge tone="critical" className="mt-1">vendor unresponsive</Badge>}
                    </td>
                    <td className="px-3 py-3 text-ink-3">{a.duration_ms ? `${(a.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-3">{ago(a.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
