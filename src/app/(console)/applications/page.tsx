"use client";

import { Plus, Search } from "@/components/icons";
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
        <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-line px-4">
          <div role="tablist" aria-label="Filter by status" className="scrollbar-thin -mb-px flex gap-x-5 overflow-x-auto">
            {FILTERS.map((f) => {
              const n = f === "all" ? data?.length : data?.filter((a) => a.status === f).length;
              const selected = status === f;
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => router.replace(f === "all" ? "/applications" : `/applications?status=${f}`)}
                  className={cx(
                    "inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 text-[13px] transition-colors duration-150",
                    selected ? "border-brand font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink",
                  )}
                >
                  {f === "all" ? "All" : STATUS_META[f].short}
                  {n != null && <span className="tabular-nums text-ink-3">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="relative my-1.5 w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, ID or city" aria-label="Search vendors" className="input h-8 min-h-8 w-full py-0 pl-9 text-[13px]" />
          </div>
        </div>

        {!data ? (
          <div className="space-y-px">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-none" />)}</div>
        ) : rows.length === 0 ? (
          <Empty title="No applications match">Try a different filter or search.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-line-2 text-left text-[12px] font-semibold text-ink-2">
                  <th className="px-4 py-2 font-semibold">Vendor</th>
                  <th className="px-3 py-2 font-semibold">Type and location</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Outstanding</th>
                  <th className="px-3 py-2 text-right font-semibold">Checked in</th>
                  <th className="px-4 py-2 text-right font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => router.push(`/applications/${a.id}`)} className="cursor-pointer transition-colors duration-150 hover:bg-line-2">
                    <td className="px-4 py-2.5">
                      <Link href={`/applications/${a.id}`} onClick={(e) => e.stopPropagation()} className="block text-[14px] font-medium text-ink hover:underline">{a.legal_name}</Link>
                      <div className="font-mono text-[12px] text-ink-3">{a.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{ENTITY_SHORT[a.entity_type]}, {a.city}</td>
                    <td className="px-3 py-2.5"><StatusPill status={a.status} /></td>
                    <td className="max-w-[300px] px-3 py-2.5">
                      {a.status === "rejected" ? (() => {
                        const r = rejectionReason(a);
                        return (
                          <div className="flex min-w-0 items-center gap-2" title={r.explain}>
                            <span className="shrink-0 rounded-full bg-critical-soft px-2 text-[12px] font-medium leading-5 text-critical-ink">{r.label}</span>
                            <span className="truncate text-ink-2">{r.title}</span>
                          </div>
                        );
                      })() : <div className="truncate text-ink-2" title={a.headline ?? ""}>{a.status === "approved" ? "-" : a.headline}</div>}
                      {a.flags?.includes("vendor_unresponsive") && <Badge tone="critical" className="mt-1">No reply from vendor</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-3">{a.duration_ms ? `${(a.duration_ms / 1000).toFixed(1)} s` : "-"}</td>
                    <td className="px-4 py-2.5 text-right text-[12px] text-ink-3">{ago(a.updated_at)}</td>
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
