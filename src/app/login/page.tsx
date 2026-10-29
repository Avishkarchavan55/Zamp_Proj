"use client";

import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useToast } from "@/components/toast";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

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
      return toast("error", "Could not sign in");
    }
    router.replace(next.startsWith("/") ? next : "/");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand"><ShieldCheck className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">VendorIQ</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Every new vendor checked, explained and decided — in under a minute.</h2>
          <ul className="mt-8 space-y-3 text-[15px] text-white/80">
            <li>Documents read by AI, verified by rules</li>
            <li>Live checks against bank and PIN-code directories</li>
            <li>Vendors chased automatically until complete</li>
          </ul>
        </div>
        <div className="text-sm text-white/50">Acme Manufacturing · Procurement</div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white"><ShieldCheck className="h-5 w-5" /></div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">Procurement console for Acme Manufacturing.</p>
          <button
            onClick={signIn}
            disabled={busy}
            className="mt-8 flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors duration-150 hover:border-brand hover:bg-brand-soft/40 disabled:opacity-60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white">PN</div>
            <div className="flex-1">
              <div className="font-medium text-ink">Continue as Priya Nair</div>
              <div className="text-[13px] text-ink-3">Procurement team · demo account</div>
            </div>
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <ArrowRight className="h-4 w-4 text-ink-3" />}
          </button>
          <p className="mt-8 text-[13px] text-ink-3">
            Are you a supplier? <a href="/apply" className="font-medium text-brand hover:underline">Register on the supplier portal</a>
          </p>
        </div>
      </div>
    </div>
  );
}
