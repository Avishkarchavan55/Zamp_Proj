"use client";

import { Mail, Send, X } from "@/components/icons";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { AppListRow } from "./api-types";
import { useToast } from "./toast";
import { Button, cx } from "./ui";

export interface Target {
  id: string;
  legal_name: string;
  contact_name?: string;
  contact_email: string;
  status: string;
}

/** Starting points; the person edits them freely before sending. */
const TEMPLATES = [
  { key: "question", label: "Ask a question", subject: "A question about your registration", body: "We are reviewing your registration and have a question:\n\n[your question]\n\nYou can simply reply to this email." },
  { key: "document", label: "Request a document", subject: "One more document needed", body: "To complete your registration, please send us [document] - for example [why it is needed].\n\nYou can upload it using the button below, or reply to this email with it attached.", link: true },
  { key: "update", label: "Status update", subject: "Update on your registration", body: "Thank you for your patience. Your registration is with our team and we expect to complete it by [date].\n\nWe will email you as soon as it is done." },
  { key: "blank", label: "Blank", subject: "", body: "" },
] as const;

export interface Draft {
  subject: string;
  message: string;
  includeLink?: boolean;
}

/** "Email vendor" on a vendor's page: a personal message from the team, alongside the automatic emails. */
export function EmailVendor({ app, onSent }: { app: Target; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Mail className="h-4 w-4" />Email vendor</Button>
      {open && <Composer vendors={[app]} onClose={() => setOpen(false)} onSent={onSent} />}
    </>
  );
}

/** "Compose email" on the Emails page: choose any vendor, then write. */
export function ComposeButton({ onSent, label = "Compose email" }: { onSent?: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useSWR<AppListRow[]>(open ? "/api/applications" : null);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Mail className="h-4 w-4" />{label}</Button>
      {open && <Composer vendors={data ?? []} loading={!data} onClose={() => setOpen(false)} onSent={onSent} />}
    </>
  );
}

/**
 * The email window. With one vendor it is fixed to them; with a list it asks who to write to.
 * `initial` pre-fills it (editing a draft, or following up) and `replaces` marks an unsent email as replaced.
 */
export function Composer({ vendors, loading, vendorId, initial, replaces, heading, onClose, onSent }: {
  vendors: Target[]; loading?: boolean; vendorId?: string; initial?: Draft; replaces?: string; heading?: string; onClose: () => void; onSent?: () => void;
}) {
  const toast = useToast();
  const [pick, setPick] = useState<string>(vendorId ?? (vendors.length === 1 ? vendors[0].id : ""));
  const [tpl, setTpl] = useState<string>(initial ? "custom" : "question");
  const [subject, setSubject] = useState<string>(initial?.subject ?? TEMPLATES[0].subject);
  const [message, setMessage] = useState<string>(initial?.message ?? TEMPLATES[0].body);
  const target = vendors.find((v) => v.id === pick);
  const [includeLink, setIncludeLink] = useState(initial?.includeLink ?? false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function template(key: string) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    setTpl(key);
    setSubject(t.subject);
    setMessage(t.body);
    if ("link" in t) setIncludeLink(true);
  }

  async function send() {
    if (!target) return;
    setBusy(true);
    const res = await fetch(`/api/applications/${target.id}/message`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, message, include_link: includeLink, replaces }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return toast("error", body.error);
    toast("success", `Email ${body.delivery}`);
    onSent?.();
    onClose();
  }

  const placeholders = /\[[^\]]+\]/.test(message);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-10" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="composer-title" className="animate-rise w-full max-w-2xl rounded-md border border-line bg-surface shadow-pop">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="composer-title" className="text-[16px] font-semibold text-ink">{heading ?? (target ? `Email ${target.legal_name}` : "Compose email")}</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {target ? <>To {target.contact_name ? `${target.contact_name}, ` : ""}{target.contact_email}. Replies come back to this application.</> : "Choose who to write to."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {vendors.length !== 1 && (
            <label className="block">
              <span className="label">Vendor</span>
              <select className="input w-full" value={pick} onChange={(e) => setPick(e.target.value)} disabled={loading}>
                <option value="">{loading ? "Loading vendors" : "Select a vendor"}</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.legal_name} ({v.id})</option>)}
              </select>
            </label>
          )}
          {!initial && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Start from">
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" aria-pressed={tpl === t.key} onClick={() => template(t.key)}
                  className={cx("rounded-full border px-3 py-1 text-[13px] font-medium transition-colors duration-150", tpl === t.key ? "border-brand bg-brand-soft text-brand-2" : "border-line text-ink-2 hover:bg-line-2")}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <label className="block">
            <span className="label">Subject</span>
            <input className="input w-full" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" />
            <span className="mt-1 block text-[12px] text-ink-3">{target ? `The reference [${target.id}] is added so replies are matched to this vendor.` : "A reference is added so replies are matched to the vendor."}</span>
          </label>
          <label className="block">
            <span className="label">Message</span>
            <textarea className="input min-h-[180px] w-full resize-y leading-relaxed" value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message" />
            <span className="mt-1 block text-[12px] text-ink-3">It starts with a greeting and ends with your name and team, so there is no need to add them.</span>
          </label>
          <label className="flex items-center gap-2.5 text-[14px] text-ink-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-action)]" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
            Include a button to open their application (to upload documents or correct details)
          </label>
          <p className="text-[12px] text-ink-3">The supplier also sees a short notice of this message in their supplier portal.</p>
          {placeholders && <p className="bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Replace the parts in [square brackets] before sending.</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} loading={busy} disabled={!target || !subject.trim() || message.trim().length < 5 || placeholders}><Send className="h-4 w-4" />Send email</Button>
        </div>
      </div>
    </div>
  );
}
