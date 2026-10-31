"use client";

import { Edit, GitBranch, Mail, Reply } from "@/components/icons";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { CommRow } from "@/components/api-types";
import { Dialog } from "@/components/dialog";
import { Composer, ComposeButton, type Draft } from "@/components/email-vendor";
import { FollowUpSteps } from "@/components/follow-up-steps";
import { Badge, Button, Card, CardHeader, Empty, PageHeader, Skeleton, cx, dateTime } from "@/components/ui";

const KIND: Record<string, string> = {
  information_request: "Information request", reminder: "Reminder", approval_notice: "Approval notice",
  review_alert: "Reviewer alert", reviewer_request: "Clarification request", manual_message: "Written by the team",
};
const STATUS: Record<string, { label: string; tone: "good" | "info" | "critical" | "warn" }> = {
  sent: { label: "Delivered", tone: "good" }, queued: { label: "Being sent", tone: "info" },
  failed: { label: "Failed", tone: "critical" }, not_configured: { label: "Not sent", tone: "warn" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "auto", label: "Automatic" },
  { key: "manual", label: "Written by the team" },
] as const;

/** An email that never went out can be edited and sent; one that did can be followed up. */
const isUnsent = (c: CommRow) => (c.status === "not_configured" || c.status === "failed") && !c.meta?.superseded_by;

/** The editable text of a system email (the saved plain-text version, without its subject, greeting, signature or link line). */
function draftOf(c: CommRow): Draft {
  const subject = c.subject.replace(/\s*\[VEN-\d{4}-\d{5}\]\s*$/, "").trim();
  let text = String(c.meta?.text ?? "").trim();
  const link = /(Update your application|Open your application): https?:\/\/\S+/i;
  const includeLink = link.test(text);
  if (c.kind === "manual_message") {
    const paras = text.split(/\n{2,}/).filter((p) => !/^Hello\b/.test(p) && !/^Regards,/.test(p) && !link.test(p));
    text = paras.join("\n\n");
  } else {
    text = text.split("\n").slice(1).join("\n").replace(new RegExp(`\\n*${link.source}\\s*$`, "i"), "").trim();
  }
  return { subject, message: text, includeLink };
}

export default function Outbox() {
  const { data, mutate } = useSWR<CommRow[]>("/api/communications", { refreshInterval: 4000 });
  const { data: sys } = useSWR<{ n8n: boolean; smtp: boolean; reminders: { reminderAfterMinutes: number; maxReminders: number } }>("/api/system");
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [help, setHelp] = useState(false);
  const [compose, setCompose] = useState<{ draft?: Draft; replaces?: string; heading: string } | null>(null);

  const rows = (data ?? []).filter((c) => filter === "all" || (filter === "manual" ? c.kind === "manual_message" : c.kind !== "manual_message"));
  const selected = rows.find((c) => c.id === sel) ?? rows[0];
  const automationOn = !!sys?.n8n;

  return (
    <div>
      <PageHeader
        title="Emails to vendors"
        subtitle="Every request, reminder and approval sent to vendors, and any email you write yourself."
        right={
          <>
            <Button variant="secondary" onClick={() => setHelp(true)}><GitBranch className="h-4 w-4" />How follow-ups work</Button>
            <ComposeButton onSent={() => mutate()} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Outbox" subtitle={`${rows.length} message${rows.length === 1 ? "" : "s"}`} />
          <div role="tablist" aria-label="Filter emails" className="flex gap-5 border-b border-line px-4">
            {FILTERS.map((f) => (
              <button
                key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                className={cx("-mb-px inline-flex h-10 items-center border-b-2 text-[13px] transition-colors duration-150", filter === f.key ? "border-brand font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink")}
              >
                {f.label}
              </button>
            ))}
          </div>
          {!data ? (
            <div className="space-y-px"><Skeleton className="h-16 rounded-none" /><Skeleton className="h-16 rounded-none" /></div>
          ) : rows.length === 0 ? (
            <Empty icon={Mail} title="No emails here yet">{filter === "manual" ? "Emails you write appear here. Use Compose email to start one." : "Requests and reminders appear here as they are sent."}</Empty>
          ) : (
            <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
              {rows.map((c) => {
                const replaced = !!c.meta?.superseded_by;
                const st = replaced ? { label: "Replaced", tone: "info" as const } : STATUS[c.status] ?? { label: c.status, tone: "info" as const };
                return (
                  <li key={c.id}>
                    <button onClick={() => setSel(c.id)} className={cx("w-full px-4 py-3 text-left transition-colors duration-150", selected?.id === c.id ? "bg-brand-soft" : "hover:bg-line-2")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[14px] font-medium text-ink">{c.legal_name}</span>
                        <Badge tone={replaced ? "neutral" : st.tone}>{st.label}</Badge>
                      </div>
                      <div className="mt-0.5 truncate text-[13px] text-ink-2">{c.subject}</div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        {KIND[c.kind] ?? c.kind}{c.kind === "manual_message" && c.meta?.sender ? `: ${String(c.meta.sender)}` : ""}, {dateTime(c.sent_at ?? c.created_at)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          {selected ? (
            <>
              <CardHeader
                title={selected.subject}
                subtitle={<>To {selected.to_email}{selected.meta?.delivered_to && selected.meta.delivered_to !== selected.to_email ? ` (delivered to ${String(selected.meta.delivered_to)})` : ""}, <Link className="text-brand hover:underline" href={`/applications/${selected.application_id}`}>{selected.application_id}</Link></>}
                right={
                  selected.kind === "review_alert" ? null : isUnsent(selected) ? (
                    <Button size="sm" onClick={() => setCompose({ draft: draftOf(selected), replaces: selected.id, heading: `Edit and send: ${selected.legal_name}` })}><Edit className="h-3.5 w-3.5" />Edit and send</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setCompose({ draft: { subject: `Re: ${selected.subject.replace(/\s*\[VEN-\d{4}-\d{5}\]\s*$/, "")}`, message: "" }, heading: `Follow up: ${selected.legal_name}` })}><Reply className="h-3.5 w-3.5" />Follow up</Button>
                  )
                }
              />
              {selected.meta?.superseded_by ? (
                <p className="border-b border-line bg-line-2 px-4 py-2 text-[13px] text-ink-2">This email was never sent. An edited version replaced it.</p>
              ) : isUnsent(selected) ? (
                <p className="border-b border-line bg-warn-soft px-4 py-2 text-[13px] text-warn-ink">This email has not been sent. Edit it and send it yourself.</p>
              ) : null}
              <div className="p-4">
                <iframe title={selected.subject} sandbox="" srcDoc={selected.body} className="h-[560px] w-full rounded-md border border-line bg-white" />
              </div>
            </>
          ) : (
            <Empty icon={Mail} title="Select an email" />
          )}
        </Card>
      </div>

      {help && (
        <Dialog title="How vendor follow-ups work" subtitle="When something is missing, emails and reminders go out automatically, so nobody has to chase." onClose={() => setHelp(false)}>
          <div className="px-5 pb-1">
            <FollowUpSteps waitMinutes={sys?.reminders.reminderAfterMinutes} maxReminders={sys?.reminders.maxReminders} />
          </div>
          <div className="space-y-1 border-t border-line px-5 py-3 text-[13px] text-ink-2">
            <p>Email automation is <span className="font-medium text-ink">{automationOn ? "on" : "off"}</span>. If it is ever down, VendorIQ sends the email itself through Gmail, so no supplier is missed.</p>
            <p>You can also write your own email at any time with Compose email, or edit one that was never sent.</p>
          </div>
        </Dialog>
      )}

      {compose && selected && (
        <Composer
          key={compose.replaces ?? compose.heading}
          vendors={[{ id: selected.application_id, legal_name: selected.legal_name ?? selected.application_id, contact_email: selected.to_email, status: "" }]}
          initial={compose.draft} replaces={compose.replaces} heading={compose.heading}
          onClose={() => setCompose(null)} onSent={() => mutate()}
        />
      )}
    </div>
  );
}
