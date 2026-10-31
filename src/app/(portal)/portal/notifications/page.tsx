"use client";

import { Bell } from "@/components/icons";
import Link from "next/link";
import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button, Card, Empty, PageHeader, Skeleton, ago, cx, dateTime } from "@/components/ui";

interface Notice {
  id: string; kind: string; title: string; body: string; link: string | null; created_at: string; read_at: string | null;
  application_id: string; legal_name: string;
}

/**
 * The same messages we email, in short, kept here so they are easy to find later.
 * New ones stay highlighted while you read; they are marked as read when you leave this page.
 */
export default function Notifications() {
  const { data, mutate } = useSWR<Notice[]>("/api/supplier/notifications", { revalidateOnFocus: false });
  const { mutate: refreshGlobal } = useSWRConfig();

  async function markAll() {
    await fetch("/api/supplier/notifications/read", { method: "POST", keepalive: true });
    await mutate();
    await refreshGlobal("/api/supplier/portal");
  }

  useEffect(() => {
    return () => {
      void fetch("/api/supplier/notifications/read", { method: "POST", keepalive: true }).then(() => refreshGlobal("/api/supplier/portal"));
    };
  }, [refreshGlobal]);

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="A short note for everything we email you, so it is always here when you need it."
        right={unread > 0 && <Button variant="secondary" onClick={markAll}>Mark all as read</Button>}
      />
      {!data ? (
        <div className="space-y-px"><Skeleton className="h-20 rounded-none" /><Skeleton className="h-20 rounded-none" /></div>
      ) : data.length === 0 ? (
        <Card><Empty icon={Bell} title="Nothing yet">When we email you about your application, a short note appears here too.</Empty></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.map((n) => (
              <li key={n.id} className={cx("flex gap-3 px-5 py-4", !n.read_at && "bg-brand-soft")}>
                <span aria-hidden className={cx("mt-2 h-2 w-2 shrink-0 rounded-[1px]", n.read_at ? "bg-transparent" : "bg-action")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h2 className={cx("text-[14px] leading-5 text-ink", n.read_at ? "font-medium" : "font-semibold")}>{n.title}</h2>
                    <span className="text-[12px] text-ink-3" title={dateTime(n.created_at)}>{dateTime(n.created_at)} ({ago(n.created_at)})</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{n.body}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 text-[12px] text-ink-3">
                    <span>{n.legal_name} <span className="font-mono">{n.application_id}</span></span>
                    {n.link && <Link href={n.link} className="text-[13px] font-medium text-brand hover:underline">Open</Link>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
