"use client";

import { Search } from "@/components/icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ACTION_GROUPS, actorLabel, auditDetailText, eventLabel, type ActivityRow } from "@/lib/activity";
import { Card, Empty, Skeleton, ago, clock, dateTime } from "./ui";

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA"); // yyyy-mm-dd in the viewer's timezone

/**
 * What happened, to which vendor, at what time, and who or what did it. Newest first, grouped by day,
 * so "what happened this morning" and "what did the system do for this vendor" are both quick to answer.
 */
export function ActivityLog() {
  const { data } = useSWR<ActivityRow[]>("/api/activity?limit=400", { refreshInterval: 10000 });
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [now] = useState(() => Date.now());
  const [limit, setLimit] = useState(100);

  const rows = useMemo(() => {
    const actions = group === "all" ? null : new Set<string>(ACTION_GROUPS.find((g) => g.key === group)?.actions ?? []);
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (actions && !actions.has(r.action)) return false;
      if (!needle) return true;
      return `${r.legal_name ?? ""} ${r.application_id} ${eventLabel(r.action)} ${auditDetailText(r.action, r.detail)} ${actorLabel(r.actor)}`.toLowerCase().includes(needle);
    });
  }, [data, group, q]);

  const days = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const r of rows.slice(0, limit)) map.set(dayKey(r.ts), [...(map.get(dayKey(r.ts)) ?? []), r]);
    return [...map.entries()];
  }, [rows, limit]);

  const dayLabel = (key: string) => {
    const today = new Date(now).toLocaleDateString("en-CA");
    const yesterday = new Date(now - 86_400_000).toLocaleDateString("en-CA");
    if (key === today) return "Today";
    if (key === yesterday) return "Yesterday";
    return new Date(`${key}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-ink-2">
          <label htmlFor="log-group">Show</label>
          <select id="log-group" className="input h-8 min-h-8 py-0 text-[13px]" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All events</option>
            {ACTION_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, event or detail" aria-label="Search the activity log" className="input h-8 min-h-8 w-full py-0 pl-9 text-[13px]" />
        </div>
      </div>

      {!data ? (
        <div className="space-y-px">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-none" />)}</div>
      ) : rows.length === 0 ? (
        <Empty title="No activity matches">Try another filter or search.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line bg-line-2 text-left text-[12px] font-semibold text-ink-2">
                <th className="w-24 px-4 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Vendor</th>
                <th className="px-3 py-2 font-semibold">What happened</th>
                <th className="w-40 px-4 py-2 font-semibold">By</th>
              </tr>
            </thead>
            {days.map(([key, list]) => (
              <tbody key={key} className="divide-y divide-line border-b border-line last:border-b-0">
                <tr className="bg-surface">
                  <th colSpan={4} scope="colgroup" className="px-4 py-2 text-left text-[12px] font-semibold text-ink-2">
                    {dayLabel(key)} <span className="font-normal text-ink-3">({list.length} {list.length === 1 ? "event" : "events"})</span>
                  </th>
                </tr>
                {list.map((r) => {
                  const detail = auditDetailText(r.action, r.detail);
                  return (
                    <tr key={r.id} className="align-top transition-colors duration-150 hover:bg-line-2">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] tabular-nums text-ink-2" title={`${dateTime(r.ts)} (${ago(r.ts)})`}>{clock(r.ts)}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/applications/${r.application_id}`} className="font-medium text-ink hover:underline">{r.legal_name ?? r.application_id}</Link>
                        <div className="font-mono text-[12px] text-ink-3">{r.application_id}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-ink">{eventLabel(r.action)}</div>
                        {detail && <div className="mt-0.5 max-w-xl text-[12px] leading-4 text-ink-3">{detail}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{actorLabel(r.actor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {rows.length > limit && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-ink-3">
          <span>Showing {limit} of {rows.length} events</span>
          <button onClick={() => setLimit((l) => l + 100)} className="font-medium text-brand hover:underline">Show 100 more</button>
        </div>
      )}
    </Card>
  );
}
