"use client";

import { Bell } from "@/components/icons";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { staffNotice, type ActivityRow, type NoticeTone } from "@/lib/activity";
import { ago, cx } from "./ui";

const KEY = "vendoriq.notifications.seen";

/** "Last seen" lives in the browser: each person has their own unread count. */
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("viq-seen", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("viq-seen", cb);
  };
}
const readSeen = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
function markSeen(iso: string) {
  try {
    localStorage.setItem(KEY, iso);
  } catch {
    // private mode: the count simply resets on reload
  }
  window.dispatchEvent(new Event("viq-seen"));
}

const MARK: Record<NoticeTone, string> = {
  info: "bg-brand", good: "bg-good", serious: "bg-serious", critical: "bg-critical", warn: "bg-warn",
};

type Item = { r: ActivityRow; n: NonNullable<ReturnType<typeof staffNotice>> };

/**
 * Events worth knowing about (a new application, a supplier reply, an auto-decision), newest first.
 * Deliberately separate from "Needs attention": that is a task list that shrinks to zero; this is a feed.
 */
export function NotificationBell() {
  const { data } = useSWR<ActivityRow[]>("/api/activity?limit=200", { refreshInterval: 8000 });
  const seen = useSyncExternalStore(subscribe, readSeen, () => null);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [mountedAt] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);

  const items: Item[] = (data ?? []).flatMap((r) => {
    const n = staffNotice(r);
    return n ? [{ r, n }] : [];
  });
  const since = (iso: string | null) => (iso ? new Date(iso).getTime() : mountedAt - 24 * 3600_000);
  const unread = items.filter((x) => new Date(x.r.ts).getTime() > since(seen)).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setSnapshot(seen);
      if (items[0]) markSeen(items[0].r.ts);
    }
    setOpen((o) => !o);
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 transition-colors duration-150 hover:bg-line-2 hover:text-ink"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[11px] font-semibold leading-none text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="animate-rise absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[14px] font-semibold text-ink">Notifications</h2>
            <Link href="/applications?view=activity" onClick={() => setOpen(false)} className="text-[13px] font-medium text-brand hover:underline">Activity log</Link>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">Nothing new yet.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {items.slice(0, 12).map(({ r, n }) => {
                const fresh = new Date(r.ts).getTime() > since(snapshot);
                return (
                  <li key={r.id}>
                    <Link href={`/applications/${r.application_id}`} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-line-2">
                      <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-[1px]", MARK[n.tone], !fresh && "opacity-30")} />
                      <span className="min-w-0 flex-1">
                        <span className={cx("block text-[13px] leading-5 text-ink", fresh && "font-medium")}>{n.title}</span>
                        {n.detail && <span className="block truncate text-[12px] text-ink-3">{n.detail}</span>}
                      </span>
                      <span className="shrink-0 pt-0.5 text-[12px] text-ink-3">{ago(r.ts)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
