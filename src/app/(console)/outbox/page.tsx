"use client";

import { Bell, CheckCircle2, GitBranch, Hourglass, Mail, Send, Webhook } from "@/components/icons";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { CommRow } from "@/components/api-types";
import { Badge, Card, CardHeader, Empty, PageHeader, Skeleton, cx, dateTime } from "@/components/ui";

const KIND: Record<string, string> = {
  information_request: "Information request", reminder: "Reminder", approval_notice: "Approval notice",
  review_alert: "Reviewer alert", reviewer_request: "Clarification request", manual_message: "Message from the team",
};
const STATUS: Record<string, { label: string; tone: "good" | "info" | "critical" | "warn" }> = {
  sent: { label: "Delivered", tone: "good" }, queued: { label: "Handed to n8n", tone: "info" },
  failed: { label: "Failed", tone: "critical" }, not_configured: { label: "Drafted (email off)", tone: "warn" },
};

export default function Outbox() {
  const { data } = useSWR<CommRow[]>("/api/communications", { refreshInterval: 4000 });
  const { data: sys } = useSWR<{ n8n: boolean; reminders: { reminderAfterMinutes: number; maxReminders: number } }>("/api/system");
  const [sel, setSel] = useState<string | null>(null);
  const selected = data?.find((c) => c.id === sel) ?? data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Emails to vendors" subtitle="Every request, reminder and approval sent on your behalf." />

      <Card>
        <CardHeader title="How vendor follow-ups work" subtitle="When something is missing, emails and reminders go out automatically - nobody has to chase." icon={GitBranch} right={<Badge tone={sys?.n8n ? "good" : "warn"}>{sys?.n8n ? "Email automation on" : "Email automation off"}</Badge>} />
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Webhook, t: "Request written", d: "VendorIQ writes the email listing exactly what is missing" },
            { icon: Send, t: "Sent from Gmail", d: "Goes out from the onboarding inbox; delivery is confirmed back" },
            { icon: Hourglass, t: `Wait ${sys?.reminders.reminderAfterMinutes ?? "N"} min`, d: "Then a reminder if there is no reply (usually 1–2 days)" },
            { icon: Bell, t: "Vendor replied?", d: "If they replied or uploaded, reminders stop and checks re-run" },
            { icon: CheckCircle2, t: `Up to ${sys?.reminders.maxReminders ?? "N"} reminders`, d: "Still silent? The vendor is flagged “No reply” for your team" },
          ].map((s, i) => (
            <div key={s.t} className="bg-surface p-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-ink"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-[12px] text-brand-2">{i + 1}</span>{s.t}</div>
              <p className="mt-1 text-[12px] text-ink-3">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">Runs on n8n. If n8n is ever down, VendorIQ sends the email itself through Gmail, so no vendor is missed.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Outbox" subtitle={`${data?.length ?? 0} messages`} icon={Mail} />
          {!data ? (
            <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : data.length === 0 ? (
            <Empty icon={Mail} title="No messages yet" />
          ) : (
            <ul className="max-h-[640px] divide-y divide-line-2 overflow-y-auto">
              {data.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSel(c.id)} className={cx("w-full px-4 py-3 text-left", selected?.id === c.id ? "bg-brand-soft/60" : "hover:bg-line-2/50")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-ink">{c.legal_name}</span>
                      <Badge tone={STATUS[c.status]?.tone ?? "info"}>{STATUS[c.status]?.label ?? c.status}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-2">{c.subject}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">{KIND[c.kind] ?? c.kind} · {c.channel === "smtp" ? "SMTP backup" : "n8n"}{c.meta?.ai_worded ? " · AI-worded" : ""} · {dateTime(c.sent_at ?? c.created_at)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-3">
          {selected ? (
            <>
              <CardHeader
                title={selected.subject}
                subtitle={<>To {selected.to_email}{selected.meta?.delivered_to && selected.meta.delivered_to !== selected.to_email ? ` (delivered to ${String(selected.meta.delivered_to)})` : ""} · <Link className="text-brand-2 hover:underline" href={`/applications/${selected.application_id}`}>{selected.application_id}</Link></>}
              />
              <div className="p-4">
                <iframe title={selected.subject} sandbox="" srcDoc={selected.body} className="h-[560px] w-full rounded-lg border border-line bg-white" />
              </div>
            </>
          ) : (
            <Empty icon={Mail} title="Select a message" />
          )}
        </Card>
      </div>
    </div>
  );
}
