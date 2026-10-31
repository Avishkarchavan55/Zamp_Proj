"use client";

import { RotateCw, ShieldAlert } from "@/components/icons";
import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

/** Loads Cloudflare's script once; a blocked script (ad blocker, firewall) rejects so the form can say so. */
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("blocked"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile, rendered explicitly so it survives client-side navigation, retries by itself and
 * follows the light/dark theme. If it cannot load at all, the vendor gets a retry button and the email
 * alternative instead of a dead widget. The token lands in the usual hidden `cf-turnstile-response` input.
 */
export function Turnstile({ siteKey, fallbackEmail }: { siteKey: string; fallbackEmail?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
          retry: "auto",
          "retry-interval": 3000,
          "refresh-expired": "auto",
          callback: () => setFailed(false),
          "error-callback": () => {
            setFailed(true);
            return true;
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, attempt]);

  return (
    <div>
      <div ref={ref} />
      {failed && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2.5 text-[13px] text-ink-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-warn-ink" />
          <span className="min-w-0 flex-1">
            The security check couldn&apos;t load - usually an ad blocker, VPN or office firewall blocking Cloudflare.
            {fallbackEmail && <> You can also email your documents to <a className="font-medium text-brand" href={`mailto:${fallbackEmail}`}>{fallbackEmail}</a>.</>}
          </span>
          <button type="button" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 font-medium text-ink hover:bg-line-2">
            <RotateCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
