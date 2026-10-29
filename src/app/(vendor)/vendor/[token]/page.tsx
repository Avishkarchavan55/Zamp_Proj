"use client";

import { AlertCircle, CheckCircle2, Clock3, FlaskConical, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { FileSlot, fetchAsFile } from "@/components/file-slot";
import { useToast } from "@/components/toast";
import { Button, Card, Skeleton, cx } from "@/components/ui";
import { ENTITY_LABELS, STATES } from "@/lib/india";
import { DOC_SLOTS } from "@/lib/policy";
import type { AppStatus, ApplicationForm, DocSlot, RequestedItem } from "@/lib/types";

interface VendorView {
  buyer: string;
  id: string;
  legal_name: string;
  contact_name: string;
  status: AppStatus;
  scenario: string | null;
  source: string;
  needs_confirmation: boolean;
  requested_items: RequestedItem[];
  documents: { slot: DocSlot; filename: string }[];
  form: ApplicationForm;
}

const FIELD_LABEL: Partial<Record<keyof ApplicationForm, string>> = {
  gstin: "GSTIN", pan: "PAN", cin: "CIN", bank_ifsc: "IFSC", bank_account_number: "Account number",
  bank_account_holder: "Account holder name", legal_name: "Legal name", pincode: "PIN code", udyam_number: "Udyam number",
};

/** Fields shown in the confirm-your-details form (email intake). */
const CONFIRM_GROUPS: { title: string; fields: [keyof ApplicationForm, string, ("mono" | "state" | "entity")?][] }[] = [
  { title: "Business", fields: [["legal_name", "Legal name"], ["entity_type", "Entity type", "entity"], ["owner_name", "Proprietor / signatory"], ["pan", "PAN", "mono"], ["gstin", "GSTIN", "mono"], ["cin", "CIN", "mono"], ["category", "What you supply"]] },
  { title: "Address & contact", fields: [["address", "Address"], ["city", "City"], ["state", "State", "state"], ["pincode", "PIN code", "mono"], ["contact_name", "Contact person"], ["contact_phone", "Phone"]] },
  { title: "Bank", fields: [["bank_account_holder", "Account holder"], ["bank_account_number", "Account number", "mono"], ["bank_ifsc", "IFSC", "mono"], ["bank_name", "Bank"]] },
  { title: "MSME", fields: [["udyam_number", "Udyam number", "mono"], ["msme_category", "MSME category"]] },
];

export default function ResubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const { data, error, mutate } = useSWR<VendorView>(`/api/vendor/${token}`, { refreshInterval: submitted ? 1500 : 0 });
  const [files, setFiles] = useState<Partial<Record<DocSlot, File | null>>>({});
  const [fields, setFields] = useState<Partial<Record<keyof ApplicationForm, string>>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (error) return <Card className="p-8 text-center text-sm text-ink-2"><AlertCircle className="mx-auto mb-2 h-6 w-6 text-critical" />{error.message}</Card>;
  if (!data) return <Skeleton className="h-80" />;

  const confirming = data.requested_items.some((i) => i.kind === "confirm");
  const docItems = data.requested_items.filter((i) => i.kind === "document" && i.slot);
  const fieldItems = confirming ? [] : data.requested_items.filter((i) => i.kind === "field" && i.field);
  const freeItems = data.requested_items.filter((i) => i.kind !== "confirm" && !(i.kind === "document" && i.slot) && !(i.kind === "field" && i.field));
  const value = (k: keyof ApplicationForm) => fields[k] ?? data.form[k] ?? "";

  async function submit() {
    setBusy(true);
    const fd = new FormData();
    fd.set("fields", JSON.stringify(fields));
    if (confirming) fd.set("confirm", "true");
    for (const [slot, f] of Object.entries(files)) if (f) fd.set(slot, f);
    const res = await fetch(`/api/vendor/${token}`, { method: "POST", body: fd });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return toast("error", body.error);
    setSubmitted(true);
    mutate();
  }

  async function loadDemoPack() {
    const list = await fetch("/demo/scenarios.json").then((r) => r.json());
    const s = list.find((x: { id: string }) => x.id === data!.scenario);
    if (!s?.resubmission) return toast("error", "No resubmission pack for this scenario");
    const next: Partial<Record<DocSlot, File>> = {};
    for (const [slot, path] of Object.entries(s.resubmission)) {
      if (slot === "fields") continue;
      next[slot as DocSlot] = await fetchAsFile(`/demo/${s.id}/${path}`, String(path).split("/").pop()!);
    }
    setFiles((f) => ({ ...f, ...next }));
    if (s.resubmission.fields) setFields((f) => ({ ...f, ...s.resubmission.fields }));
  }

  if (submitted || data.status !== "awaiting_vendor") {
    const state = data.status;
    return (
      <Card className="animate-rise mx-auto max-w-xl p-8 text-center">
        {state === "processing" ? (
          <>
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand" />
            <h1 className="text-lg font-semibold">Thanks — we&apos;re re-checking your application</h1>
            <p className="mt-1 text-sm text-ink-2">This usually takes under a minute. You can close this page.</p>
          </>
        ) : state === "approved" ? (
          <>
            <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-good" />
            <h1 className="text-lg font-semibold">You&apos;re approved</h1>
            <p className="mt-1 text-sm text-ink-2">{data.legal_name} is now an approved supplier to {data.buyer}. A confirmation email is on its way.</p>
          </>
        ) : state === "awaiting_vendor" ? (
          <>
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-warn-ink" />
            <h1 className="text-lg font-semibold">We still need something from you</h1>
            <p className="mt-1 text-sm text-ink-2">Please check the updated list.</p>
            <Button className="mt-4" onClick={() => setSubmitted(false)}>See what&apos;s needed</Button>
          </>
        ) : (
          <>
            <Clock3 className="mx-auto mb-3 h-8 w-8 text-ink-3" />
            <h1 className="text-lg font-semibold">Thank you — your application is with our team</h1>
            <p className="mt-1 text-sm text-ink-2">A member of the onboarding team will contact you if anything else is needed. Reference {data.id}.</p>
          </>
        )}
      </Card>
    );
  }

  const outstanding = data.requested_items.length;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-ink-3">Application {data.id}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {confirming
            ? `Hello ${data.contact_name || "there"}, please confirm the details we read from your documents`
            : `Hello ${data.contact_name || "there"}, we need ${outstanding === 1 ? "one thing" : `${outstanding} things`} to finish verifying ${data.legal_name}`}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {confirming ? "We pre-filled everything from the documents you emailed. Correct anything that's wrong, add what's missing, then confirm." : "Everything else you submitted has been kept — only update what's listed below."}
        </p>
      </div>

      {data.scenario && (
        <button onClick={loadDemoPack} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand-soft/40 px-4 py-2.5 text-left text-[13px] font-medium text-brand-2">
          <FlaskConical className="h-4 w-4" /> Demo: attach this vendor&apos;s corrected documents / values
        </button>
      )}

      {confirming && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-[13px] text-ink-2"><Mail className="h-4 w-4 text-ink-3" /> Read automatically from your email attachments — please check carefully.</div>
          <div className="space-y-5">
            {CONFIRM_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">{g.title}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.fields.map(([k, label, kind]) => (
                    <label key={k} className="block">
                      <span className="label">{label}</span>
                      {kind === "state" ? (
                        <select className="input w-full" value={value(k)} onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}>
                          <option value="">Select…</option>
                          {STATES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : kind === "entity" ? (
                        <select className="input w-full" value={value(k)} onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}>
                          {Object.entries(ENTITY_LABELS).map(([ek, ev]) => <option key={ek} value={ek}>{ev}</option>)}
                        </select>
                      ) : (
                        <input className={cx("input w-full", kind === "mono" && "font-mono", !value(k) && "border-warn/60 bg-warn-soft/30")} value={value(k)} placeholder="Not found in your documents" onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))} />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {docItems.length > 0 && (
        <Card className="space-y-3 p-5">
          {docItems.map((i) => (
            <div key={i.code}>
              <div className="mb-1.5 text-[13.5px] font-semibold text-ink">{i.title}</div>
              <p className="mb-2 text-[13px] text-ink-2">{i.instruction}</p>
              <FileSlot label={DOC_SLOTS[i.slot!].label} hint={DOC_SLOTS[i.slot!].hint} required highlight file={files[i.slot!] ?? null} onChange={(f) => setFiles((x) => ({ ...x, [i.slot!]: f }))} />
            </div>
          ))}
        </Card>
      )}

      {fieldItems.length > 0 && (
        <Card className="space-y-4 p-5">
          {fieldItems.map((i) => (
            <div key={i.code}>
              <div className="text-[13.5px] font-semibold text-ink">{i.title}</div>
              <p className="mb-2 text-[13px] text-ink-2">{i.instruction}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-3">{FIELD_LABEL[i.field!] ?? i.field}</span>
                <input className="input min-w-0 flex-1 font-mono uppercase" value={value(i.field!)} onChange={(e) => setFields((f) => ({ ...f, [i.field!]: e.target.value }))} />
                {i.suggested_value && (
                  <button onClick={() => setFields((f) => ({ ...f, [i.field!]: i.suggested_value }))} className="flex items-center gap-1 rounded-lg border border-brand/30 px-2.5 py-1.5 text-[12.5px] font-medium text-brand-2 hover:bg-brand-soft">
                    <Sparkles className="h-3.5 w-3.5" /> Use {i.suggested_value}
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {freeItems.length > 0 && (
        <Card className="space-y-4 p-5">
          {freeItems.map((i) => (
            <div key={i.code}>
              <div className="text-[13.5px] font-semibold text-ink">{i.title}</div>
              <p className="text-[13px] text-ink-2">{i.instruction}</p>
            </div>
          ))}
          <div>
            <div className="mb-2 text-xs text-ink-3">Upload supporting documents (replace any of the following):</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(DOC_SLOTS) as DocSlot[]).map((slot) => (
                <FileSlot key={slot} label={DOC_SLOTS[slot].label} hint={DOC_SLOTS[slot].hint} file={files[slot] ?? null} onChange={(f) => setFiles((x) => ({ ...x, [slot]: f }))} />
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-3"><CheckCircle2 className="h-3.5 w-3.5" /> {data.documents.length} documents already on file · you can also just reply to our email with attachments</div>
        <Button onClick={submit} loading={busy} className="px-6">{confirming ? "Confirm details" : "Submit update"}</Button>
      </div>
    </div>
  );
}
