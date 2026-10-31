"use client";

import { ArrowRight, Loader2, ShieldCheck } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/toast";
import { StatusPill, cx } from "@/components/ui";
import type { AppStatus } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

type Portal = "company" | "supplier";

/** The four ways an application can end, in the same tags the company console uses. */
const OUTCOMES: { status: AppStatus; text: string }[] = [
  { status: "approved", text: "Every check passed. An ERP vendor record is ready." },
  { status: "awaiting_vendor", text: "Something is missing. The supplier is emailed and reminded until it arrives." },
  { status: "in_review", text: "The documents disagree. A person decides, with the evidence laid out." },
  { status: "rejected", text: "A hard stop, such as a bank account that belongs to another company." },
];

const FOR_SUPPLIERS = [
  ["See where your application stands", "From received, to checked, to approved."],
  ["Know exactly what we need", "If a document is missing, it is listed here with a button to upload it."],
  ["Get a notification for every email", "The same message we email you, kept short, so it is easy to find later."],
];

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [portal, setPortal] = useState<Portal>(params.get("portal") === "supplier" ? "supplier" : "company");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const toast = useToast();
  const { data: suppliers } = useSWR<{ id: string; legal_name: string; status: string }[]>(portal === "supplier" ? "/api/supplier/accounts" : null);

  async function pickSupplier(id: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/supplier/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pick: id }) });
    if (!res.ok) {
      setBusy(false);
      return setError("Could not open the supplier portal. Please try again.");
    }
    router.replace("/portal");
  }

  async function signInCompany() {
    setBusy(true);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: "reviewer" }) });
    if (!res.ok) {
      setBusy(false);
      return toast("error", "Could not sign in. Please try again.");
    }
    router.replace(next.startsWith("/") ? next : "/");
  }

  async function signInSupplier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/supplier/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, email }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(body.error ?? "Could not sign in. Please try again.");
    }
    router.replace("/portal");
  }

  return (
    <div className="grid min-h-viewport lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-action"><ShieldCheck className="h-4 w-4" /></span>
          <span className="text-[14px] font-semibold">VendorIQ</span>
        </div>
        {portal === "company" ? (
          <div className="max-w-lg">
            <h2 className="text-[28px] font-semibold leading-9 tracking-[-0.01em]">Vendor onboarding, from submission to decision.</h2>
            <p className="mt-3 max-w-md text-[14px] leading-5 text-white/70">Documents are read by AI and checked by written rules. Every application ends in one of four outcomes, with the reason shown.</p>
            <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {OUTCOMES.map((o) => (
                <li key={o.status} className="grid grid-cols-[168px_1fr] items-center gap-4 py-3">
                  <span><StatusPill status={o.status} /></span>
                  <span className="text-[13px] leading-5 text-white/75">{o.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="max-w-lg">
            <h2 className="text-[28px] font-semibold leading-9 tracking-[-0.01em]">Your supplier registration, in one place.</h2>
            <p className="mt-3 max-w-md text-[14px] leading-5 text-white/70">Pick your company to see your applications, what we need from you, and your notifications.</p>
            <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {FOR_SUPPLIERS.map(([t, d]) => (
                <li key={t} className="py-3">
                  <div className="text-[14px] font-medium">{t}</div>
                  <div className="text-[13px] leading-5 text-white/70">{d}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-[13px] text-white/55">Acme Manufacturing</div>
      </div>

      <div className="relative flex items-center justify-center px-6 py-12">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-sm">
          <span className="mb-6 flex h-8 w-8 items-center justify-center rounded-md bg-action text-white lg:hidden"><ShieldCheck className="h-4 w-4" /></span>
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em] text-ink">Sign in to VendorIQ</h1>
          <p className="mt-1 text-[14px] text-ink-2">Choose the portal you are here for.</p>

          <div role="radiogroup" aria-label="Portal" className="mt-5 grid grid-cols-2 gap-2">
            {([
              ["company", "Company portal", "Acme procurement team"],
              ["supplier", "Supplier portal", "Suppliers and applicants"],
            ] as const).map(([key, title, hint]) => (
              <button
                key={key} type="button" role="radio" aria-checked={portal === key} onClick={() => { setPortal(key); setError(""); }}
                className={cx("rounded-md border p-3 text-left transition-colors duration-150", portal === key ? "border-brand bg-brand-soft" : "border-line-strong bg-surface hover:bg-line-2")}
              >
                <span className="block text-[14px] font-semibold text-ink">{title}</span>
                <span className="block text-[12px] text-ink-3">{hint}</span>
              </button>
            ))}
          </div>

          {portal === "company" ? (
            <div className="mt-6">
              <button
                onClick={signInCompany}
                disabled={busy}
                className="btn flex w-full items-center gap-3 rounded-md border border-line-strong bg-surface p-3 text-left transition-colors duration-150 hover:bg-line-2 disabled:opacity-60"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-line text-[13px] font-semibold text-ink-2">GA</span>
                <span className="flex-1 leading-tight">
                  <span className="block text-[14px] font-medium text-ink">Continue as Gaurav Ahuja</span>
                  <span className="block text-[12px] text-ink-3">Procurement team</span>
                </span>
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <ArrowRight className="h-4 w-4 text-ink-3" />}
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-[13px] text-ink-2">Continue as a supplier</p>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {!suppliers ? <div className="h-14 animate-pulse rounded-md bg-line" /> : suppliers.length === 0 ? (
                  <p className="text-[13px] text-ink-3">No suppliers yet. Register your business to get started.</p>
                ) : suppliers.map((s) => (
                  <button key={s.id} onClick={() => pickSupplier(s.id)} disabled={busy}
                    className="btn flex w-full items-center gap-3 rounded-md border border-line-strong bg-surface p-3 text-left transition-colors duration-150 hover:bg-line-2 disabled:opacity-60">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-line text-[13px] font-semibold text-ink-2">{s.legal_name.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[14px] font-medium text-ink">{s.legal_name}</span>
                      <span className="block text-[12px] text-ink-3"><span className="font-mono">{s.id}</span> · {s.status}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
                  </button>
                ))}
              </div>
              {error && <p role="alert" className="mt-3 bg-critical-soft px-3 py-2 text-[13px] text-critical-ink">{error}</p>}
              <button type="button" onClick={() => setManual((m) => !m)} className="mt-4 text-[13px] font-medium text-brand hover:underline">
                {manual ? "Hide" : "Have a reference and email? Sign in with them"}
              </button>
              {manual && (
            <form onSubmit={signInSupplier} className="mt-3 space-y-4" noValidate>
              <label className="block">
                <span className="label">Application reference</span>
                <input className="input w-full font-mono uppercase" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="VEN-2026-00460" autoComplete="off" required />
              </label>
              <label className="block">
                <span className="label">Contact email on the application</span>
                <input type="email" className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@yourcompany.com" autoComplete="email" required />
              </label>
              <button type="submit" disabled={busy || !reference.trim() || !email.trim()} className="btn flex h-10 w-full items-center justify-center gap-2 rounded-md bg-action text-[14px] font-medium text-white transition-colors duration-150 hover:bg-action-2 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in to supplier portal
              </button>
              <p className="text-[12px] leading-4 text-ink-3">Your reference is in the email we sent you, and on the confirmation page after you applied.</p>
            </form>
              )}
            </div>
          )}

          <p className="mt-6 border-t border-line pt-4 text-[13px] text-ink-3">
            {portal === "supplier"
              ? <>New supplier? <a href="/apply" className="font-medium text-brand hover:underline">Register your business</a></>
              : <>Are you a supplier? <button type="button" onClick={() => setPortal("supplier")} className="font-medium text-brand hover:underline">Go to the supplier portal</button></>}
          </p>
        </div>
      </div>
    </div>
  );
}
