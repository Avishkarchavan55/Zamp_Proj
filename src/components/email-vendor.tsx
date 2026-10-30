"use client";

import { Mail, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "./toast";
import { Button, cx } from "./ui";

interface Target {
  id: string;
  legal_name: string;
  contact_name: string;
  contact_email: string;
  status: string;
}

/** Starting points; the person edits them freely before sending. */
const TEMPLATES = [
  { key: "question", label: "Ask a question", subject: "A question about your registration", body: "We are reviewing your registration and have a question:\n\n[your question]\n\nYou can simply reply to this email." },
  { key: "document", label: "Request a document", subject: "One more document needed", body: "To complete your registration, please send us [document] — for example [why it is needed].\n\nYou can upload it using the button below, or reply to this email with it attached.", link: true },
  { key: "update", label: "Status update", subject: "Update on your registration", body: "Thank you for your patience. Your registration is with our team and we expect to complete it by [date].\n\nWe will email you as soon as it is done." },
  { key: "blank", label: "Blank", subject: "", body: "" },
] as const;

/** "Email vendor": a personal message from the team, alongside the automatic requests and reminders. */
export function EmailVendor({ app, onSent }: { app: Target; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Mail className="h-4 w-4" />Email vendor</Button>
      {open && <Composer app={app} onClose={() => setOpen(false)} onSent={onSent} />}
    </>
  );
}

function Composer({ app, onClose, onSent }: { app: Target; onClose: () => void; onSent?: () => void }) {
  const toast = useToast();
  const [tpl, setTpl] = useState<string>("question");
  const [subject, setSubject] = useState<string>(TEMPLATES[0].subject);
  const [message, setMessage] = useState<string>(TEMPLATES[0].body);
  const [includeLink, setIncludeLink] = useState(app.status === "awaiting_vendor");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(key: string) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    setTpl(key);
    setSubject(t.subject);
    setMessage(t.body);
    if ("link" in t) setIncludeLink(true);
  }

  async function send() {
    setBusy(true);
    const res = await fetch(`/api/applications/${app.id}/message`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, message, include_link: includeLink }),
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
      <div role="dialog" aria-modal="true" aria-labelledby="email-vendor-title" className="animate-rise w-full max-w-2xl rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="email-vendor-title" className="text-[16px] font-semibold text-ink">Email {app.legal_name}</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">To {app.contact_name ? `${app.contact_name} · ` : ""}{app.contact_email}. Replies come back to this application.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Start from">
            {TEMPLATES.map((t) => (
              <button key={t.key} type="button" aria-pressed={tpl === t.key} onClick={() => pick(t.key)}
                className={cx("rounded-full border px-3 py-1 text-[13px] font-medium transition-colors", tpl === t.key ? "border-brand bg-brand-soft text-brand-2" : "border-line text-ink-2 hover:bg-line-2")}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="label">Subject</span>
            <input className="input w-full" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" />
            <span className="mt-1 block text-[12px] text-ink-3">The reference [{app.id}] is added so replies are matched to this vendor.</span>
          </label>
          <label className="block">
            <span className="label">Message</span>
            <textarea className="input min-h-[180px] w-full resize-y leading-relaxed" value={message} maxLength={5000} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message…" />
            <span className="mt-1 block text-[12px] text-ink-3">Starts with &ldquo;Hello {app.contact_name || "there"},&rdquo; and ends with your name and team — no need to add them.</span>
          </label>
          <label className="flex items-center gap-2.5 text-[14px] text-ink-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
            Include a button to open their application (to upload documents or correct details)
          </label>
          {placeholders && <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Replace the parts in [square brackets] before sending.</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} loading={busy} disabled={!subject.trim() || message.trim().length < 5 || placeholders}><Send className="h-4 w-4" />Send email</Button>
        </div>
      </div>
    </div>
  );
}
