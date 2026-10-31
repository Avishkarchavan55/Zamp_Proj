"use client";

import { ArrowRight, CornerDownLeft, FileStack, Inbox, LayoutDashboard, InformationIcon, Plus, Search, UsersRound } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { AppListRow } from "./api-types";
import { StatusPill, cx } from "./ui";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ElementType;
  href: string;
  external?: boolean;
  app?: AppListRow;
}

const PAGES: Item[] = [
  { id: "p-overview", label: "Overview", icon: LayoutDashboard, href: "/" },
  { id: "p-apps", label: "All vendors", icon: FileStack, href: "/applications" },
  { id: "p-review", label: "Needs attention", icon: UsersRound, href: "/review" },
  { id: "p-comms", label: "Emails to vendors", icon: Inbox, href: "/outbox" },
  { id: "p-policy", label: "Info", icon: InformationIcon, href: "/info" },
  { id: "p-new", label: "New vendor application", hint: "Opens the supplier portal", icon: Plus, href: "/apply", external: true },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { data: apps } = useSWR<AppListRow[]>("/api/applications");

  useEffect(() => input.current?.focus(), []);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const vendors: Item[] = (apps ?? [])
      .filter((a) => !needle || `${a.legal_name} ${a.id} ${a.city} ${a.category}`.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((a) => ({ id: a.id, label: a.legal_name, hint: `${a.id} · ${a.city}`, href: `/applications/${a.id}`, app: a }));
    const pages = PAGES.filter((p) => !needle || p.label.toLowerCase().includes(needle));
    return [...vendors, ...pages];
  }, [apps, q]);

  function go(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.external) window.open(item.href, "_blank");
    else router.push(item.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="animate-rise w-full max-w-xl overflow-hidden rounded-md border border-line bg-surface shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter") go(items[active]);
            }}
            placeholder="Search vendors by name, ID or city - or jump to a page"
            className="h-12 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 font-mono text-[12px] text-ink-3">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">No matches</li>}
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === active ? "bg-brand-soft" : "")}
              >
                {it.icon ? <it.icon className="h-4 w-4 text-ink-3" /> : <FileStack className="h-4 w-4 text-ink-3" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{it.label}</div>
                  {it.hint && <div className="truncate font-mono text-[12px] text-ink-3">{it.hint}</div>}
                </div>
                {it.app && <StatusPill status={it.app.status} />}
                {i === active ? <CornerDownLeft className="h-3.5 w-3.5 text-brand" /> : <ArrowRight className="h-3.5 w-3.5 text-transparent" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
