"use client";

import { ArrowRight, BadgeIndianRupee, Building2, CheckCircle2, FileSpreadsheet, FlaskConical, Landmark, Loader2, Mail, Paperclip, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { FileSlot, fetchAsFile } from "@/components/file-slot";
import { useToast } from "@/components/toast";
import { useLocalStorage } from "@/components/use-local";
import { Button, Card, cx } from "@/components/ui";
import { ENTITY_LABELS, STATES } from "@/lib/india";
import { DOC_SLOTS, REQUIRED_DOCS } from "@/lib/policy";
import type { ApplicationForm, DocSlot, EntityType } from "@/lib/types";

interface Scenario {
  id: string;
  group: "demo" | "extra" | "history";
  title: string;
  vendor: string;
  summary: string;
  expected: string;
  form: ApplicationForm;
  files: Partial<Record<DocSlot, string>>;
}

const EMPTY: ApplicationForm = {
  legal_name: "", trade_name: "", entity_type: "private_limited", owner_name: "", pan: "", gstin: "", cin: "",
  address: "", city: "", state: "", pincode: "", contact_name: "", contact_email: "", contact_phone: "", website: "",
  category: "", bank_account_holder: "", bank_account_number: "", bank_ifsc: "", bank_name: "",
  msme_registered: "", udyam_number: "", msme_category: "",
};

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const INTAKE_EMAIL = process.env.NEXT_PUBLIC_INTAKE_EMAIL;
const GOOGLE_FORM_URL = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL;

/** Cloudflare Turnstile widget (invisible-by-default captcha); renders nothing when not configured. */
function Turnstile() {
  useEffect(() => {
    if (!TURNSTILE_KEY || document.getElementById("cf-turnstile-script")) return;
    const s = document.createElement("script");
    s.id = "cf-turnstile-script";
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);
  if (!TURNSTILE_KEY) return null;
  return <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-theme="light" />;
}

export default function ApplyPage() {
  const [form, setForm] = useState<ApplicationForm>(EMPTY);
  const [files, setFiles] = useState<Partial<Record<DocSlot, File | null>>>({});
  const [scenario, setScenario] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; runId: string } | null>(null);
  const toast = useToast();
  const required = REQUIRED_DOCS[form.entity_type];
  const set = (k: keyof ApplicationForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData();
    fd.set("form", JSON.stringify(form));
    if (scenario) fd.set("scenario", scenario);
    const token = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value;
    if (token) fd.set("cf-turnstile-response", token);
    for (const [slot, f] of Object.entries(files)) if (f) fd.set(slot, f);
    const res = await fetch("/api/applications", { method: "POST", body: fd });
    const body = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast("error", body.error);
    setDone(body);
  }

  if (done) {
    return (
      <Card className="animate-rise mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-good-soft"><CheckCircle2 className="h-6 w-6 text-good-ink" /></div>
        <h1 className="text-xl font-semibold">Application received</h1>
        <p className="mt-2 text-sm text-ink-2">Your reference is <span className="font-mono font-semibold text-ink">{done.id}</span>. We&apos;re verifying your documents now and will email <span className="font-medium text-ink">{form.contact_email}</span> if we need anything else.</p>
        <div className="mt-6 flex flex-col items-center gap-2 border-t border-line pt-5">
          <div className="text-xs text-ink-3">Procurement view</div>
          <a href={`/runs/${done.runId}`} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-2">Watch verification live <ArrowRight className="h-4 w-4" /></a>
          <button onClick={() => { setDone(null); setForm(EMPTY); setFiles({}); setScenario(null); }} className="mt-1 text-[13px] text-ink-2 hover:text-ink">Submit another application</button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Register as a supplier</h1>
        <p className="mt-1 text-sm text-ink-2">Tell us about your business and upload your registration documents. Most applications are verified within a minute.</p>
      </div>

      <OtherChannels />

      <DemoLoader
        active={scenario}
        onLoad={(s, f, email) => {
          setForm({ ...s.form, contact_email: email || s.form.contact_email });
          setFiles(f);
          setScenario(s.id);
        }}
      />

      <form onSubmit={submit} className="space-y-6">
        <Section icon={Building2} title="Business details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name of business" required className="sm:col-span-2"><input className="input w-full" value={form.legal_name} onChange={set("legal_name")} required /></Field>
            <Field label="Entity type" required>
              <select className="input w-full" value={form.entity_type} onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value as EntityType }))}>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={form.entity_type === "proprietorship" ? "Proprietor's full name" : "Authorised signatory"} required={form.entity_type === "proprietorship"}><input className="input w-full" value={form.owner_name} onChange={set("owner_name")} /></Field>
            <Field label="PAN" required><input className="input w-full font-mono uppercase" value={form.pan} onChange={set("pan")} placeholder="AAAAA9999A" /></Field>
            <Field label="GSTIN" required><input className="input w-full font-mono uppercase" value={form.gstin} onChange={set("gstin")} placeholder="27AAAAA9999A1Z5" /></Field>
            {form.entity_type !== "proprietorship" && form.entity_type !== "partnership" && (
              <Field label="CIN / LLPIN" required className="sm:col-span-2"><input className="input w-full font-mono uppercase" value={form.cin} onChange={set("cin")} placeholder="U12345MH2019PTC123456" /></Field>
            )}
            <Field label="What will you supply?"><input className="input w-full" value={form.category} onChange={set("category")} /></Field>
            <Field label="Website"><input className="input w-full" value={form.website} onChange={set("website")} /></Field>
          </div>
        </Section>

        <Section icon={UserRound} title="Address & contact">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Registered address" required className="sm:col-span-3"><input className="input w-full" value={form.address} onChange={set("address")} /></Field>
            <Field label="City" required><input className="input w-full" value={form.city} onChange={set("city")} /></Field>
            <Field label="State" required>
              <select className="input w-full" value={form.state} onChange={set("state")}>
                <option value="">Select…</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="PIN code" required><input className="input w-full" value={form.pincode} onChange={set("pincode")} /></Field>
            <Field label="Contact person" required><input className="input w-full" value={form.contact_name} onChange={set("contact_name")} /></Field>
            <Field label="Email" required><input type="email" className="input w-full" value={form.contact_email} onChange={set("contact_email")} required /></Field>
            <Field label="Phone"><input className="input w-full" value={form.contact_phone} onChange={set("contact_phone")} /></Field>
          </div>
        </Section>

        <Section icon={Landmark} title="Bank account for payments">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account holder name" required><input className="input w-full" value={form.bank_account_holder} onChange={set("bank_account_holder")} /></Field>
            <Field label="Bank name"><input className="input w-full" value={form.bank_name} onChange={set("bank_name")} /></Field>
            <Field label="Account number" required><input className="input w-full font-mono" value={form.bank_account_number} onChange={set("bank_account_number")} /></Field>
            <Field label="IFSC" required><input className="input w-full font-mono uppercase" value={form.bank_ifsc} onChange={set("bank_ifsc")} placeholder="HDFC0000123" /></Field>
          </div>
        </Section>

        <Section icon={BadgeIndianRupee} title="MSME (Udyam) registration" subtitle="Registered micro and small enterprises are paid within 45 days under the MSMED Act — tell us so we set the right payment terms.">
          <div className="flex flex-wrap gap-2">
            {[["yes", "Yes, we are Udyam registered"], ["no", "No / not applicable"]].map(([v, l]) => (
              <button type="button" key={v} onClick={() => setForm((f) => ({ ...f, msme_registered: v }))}
                className={cx("rounded-lg border px-3.5 py-2 text-[13px] font-medium", form.msme_registered === v ? "border-brand bg-brand-soft text-brand-2" : "border-line text-ink-2 hover:bg-line-2")}>
                {l}
              </button>
            ))}
          </div>
          {form.msme_registered === "yes" && (
            <div className="animate-rise mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Udyam registration number" required><input className="input w-full font-mono uppercase" value={form.udyam_number} onChange={set("udyam_number")} placeholder="UDYAM-MH-26-0012345" /></Field>
              <Field label="Category" required>
                <select className="input w-full" value={form.msme_category} onChange={set("msme_category")}>
                  <option value="">Select…</option>
                  {["Micro", "Small", "Medium"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Section>

        <Section icon={Paperclip} title="Documents" subtitle={`Required for a ${ENTITY_LABELS[form.entity_type]}. PDF, PNG or JPG up to 4 MB — scans are fine.`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(DOC_SLOTS) as DocSlot[]).filter((s) => required.includes(s) || (s === "udyam" && form.msme_registered === "yes")).map((slot) => (
              <FileSlot key={slot} label={DOC_SLOTS[slot].label} hint={DOC_SLOTS[slot].hint} required file={files[slot] ?? null} onChange={(f) => setFiles((x) => ({ ...x, [slot]: f }))} />
            ))}
          </div>
        </Section>

        <Turnstile />

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-3">By submitting you confirm the information is accurate. Incomplete applications are not rejected — we&apos;ll tell you exactly what&apos;s missing.</p>
          <Button type="submit" loading={submitting} className="px-6">{submitting ? "Uploading…" : "Submit application"}</Button>
        </div>
      </form>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Icon className="h-4 w-4 text-ink-3" />{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}{required && <span className="text-critical"> *</span>}</span>
      {children}
    </label>
  );
}

function DemoLoader({ active, onLoad }: { active: string | null; onLoad: (s: Scenario, files: Partial<Record<DocSlot, File>>, email: string) => void }) {
  const [list, setList] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [inbox, setInbox] = useLocalStorage("vendoriq.demoInbox", "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/demo/scenarios.json").then((r) => r.json()).then(setList).catch(() => {});
  }, []);

  async function load(s: Scenario) {
    setLoading(s.id);
    const files: Partial<Record<DocSlot, File>> = {};
    for (const [slot, name] of Object.entries(s.files)) files[slot as DocSlot] = await fetchAsFile(`/demo/${s.id}/${name}`, name!.split("/").pop()!);
    onLoad(s, files, inbox.trim());
    setLoading(null);
  }

  const shown = list.filter((s) => s.group === "demo" || s.group === "extra");
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60">
      <button onClick={() => setOpen((o) => !o)} className="flex min-h-11 w-full items-center justify-between px-4 text-left">
        <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink-2"><FlaskConical className="h-4 w-4 text-ink-3" /> Demo: fill this form with a test vendor</span>
        <span className="text-[13px] text-brand">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {shown.map((s) => (
              <button
                key={s.id}
                type="button"
                title={`${s.vendor} — ${s.summary}`}
                onClick={() => load(s)}
                disabled={!!loading}
                className={cx(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[13.5px] transition-colors duration-150",
                  active === s.id ? "border-brand bg-brand-soft text-brand-2" : "border-line bg-surface text-ink hover:border-brand/50",
                )}
              >
                {loading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active === s.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {s.title}
              </button>
            ))}
          </div>
          <label className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            <Mail className="h-3.5 w-3.5" /> Send the vendor emails to
            <input value={inbox} onChange={(e) => setInbox(e.target.value)} placeholder="your inbox (optional)" className="input min-w-0 flex-1 py-1.5" />
          </label>
        </div>
      )}
    </div>
  );
}

function OtherChannels() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-ink-2">
      <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-ink-3" />Prefer email? Send your documents to {INTAKE_EMAIL ? <a className="font-medium text-brand" href={`mailto:${INTAKE_EMAIL}`}>{INTAKE_EMAIL}</a> : "our onboarding inbox"}.</span>
      {GOOGLE_FORM_URL && <span className="flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-ink-3" /><a className="font-medium text-brand" href={GOOGLE_FORM_URL} target="_blank">Or use our Google Form</a></span>}
    </p>
  );
}
