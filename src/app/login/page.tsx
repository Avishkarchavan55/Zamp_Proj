"use client";

import { ArrowRight, Loader2, ShieldCheck } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useToast } from "@/components/toast";
import { StatusPill } from "@/components/ui";
import type { AppStatus } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

/** The four ways an application can end, in the same tags the console uses. */
const OUTCOMES: { status: AppStatus; text: string }[] = [
  { status: "approved", text: "Every check passed. An ERP vendor record is ready." },
  { status: "awaiting_vendor", text: "Something is missing. The vendor is emailed and reminded until it arrives." },
  { status: "in_review", text: "The documents disagree. A person decides, with the evidence laid out." },
  { status: "rejected", text: "A hard stop, such as a bank account that belongs to another company." },
];

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function signIn() {
    setBusy(true);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as: "reviewer" }) });
    if (!res.ok) {
      setBusy(false);
      return toast("error", "Could not sign in. Please try again.");
    }
    router.replace(next.startsWith("/") ? next : "/");
  }

  return (
    <div className="grid min-h-viewport lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-action"><ShieldCheck className="h-4 w-4" /></span>
          <span className="text-[14px] font-semibold">VendorIQ</span>
        </div>
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
        <div className="text-[13px] text-white/55">Acme Manufacturing, Procurement</div>
      </div>

      <div className="relative flex items-center justify-center px-6 py-12">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-sm">
          <span className="mb-6 flex h-8 w-8 items-center justify-center rounded-md bg-action text-white lg:hidden"><ShieldCheck className="h-4 w-4" /></span>
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em] text-ink">Sign in to VendorIQ</h1>
          <p className="mt-1 text-[14px] text-ink-2">Procurement console for Acme Manufacturing.</p>
          <button
            onClick={signIn}
            disabled={busy}
            className="btn mt-6 flex w-full items-center gap-3 rounded-md border border-line-strong bg-surface p-3 text-left transition-colors duration-150 hover:bg-line-2 disabled:opacity-60"
          >
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-line text-[13px] font-semibold text-ink-2">GA</span>
            <span className="flex-1 leading-tight">
              <span className="block text-[14px] font-medium text-ink">Continue as Gaurav Ahuja</span>
              <span className="block text-[12px] text-ink-3">Procurement team</span>
            </span>
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <ArrowRight className="h-4 w-4 text-ink-3" />}
          </button>
          <p className="mt-6 text-[13px] text-ink-3">
            Are you a supplier? <a href="/apply" className="font-medium text-brand hover:underline">Register on the supplier portal</a>
          </p>
        </div>
      </div>
    </div>
  );
}
