"use client";

import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, Power, XCircle } from "@/components/icons";
import { useCallback, useRef, useState } from "react";
import { Dialog } from "./dialog";
import { Button, cx } from "./ui";

type State = "ok" | "warn" | "error" | "off";
interface Result { step: string; state: State; title: string; detail: string; ms: number }

/** In the order a recording needs them. Each one is a separate call so results appear as they arrive. */
const STEPS = [
  { step: "database", label: "Database" },
  { step: "n8n", label: "Email automation (n8n)" },
  { step: "gmail", label: "Gmail inbox" },
  { step: "form", label: "Google Form" },
  { step: "ai", label: "Document readers (AI)" },
  { step: "repairs", label: "Stuck items" },
] as const;

const ICON: Record<State, { Icon: React.ElementType; cls: string }> = {
  ok: { Icon: CheckCircle2, cls: "text-good" },
  warn: { Icon: AlertTriangle, cls: "text-serious" },
  error: { Icon: XCircle, cls: "text-critical" },
  off: { Icon: MinusCircle, cls: "text-ink-3" },
};

/** Wakes every part of the system and reports what is up, what was fixed and what needs a person. */
export function WakeUp() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const token = useRef(0);

  const run = useCallback(async () => {
    const mine = ++token.current;
    setResults({});
    setRunning(true);
    await Promise.all(STEPS.map(async ({ step, label }, i) => {
      let r: Result = { step, state: "error", title: label, detail: "Could not reach the server", ms: 0 };
      await new Promise((go) => setTimeout(go, i * 300));
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/wake?step=${step}`, { method: "POST" });
          if (res.ok) { r = await res.json(); break; }
          r = { step, state: "error", title: label, detail: res.status === 401 ? "Signed out. Sign in again." : `Request failed (${res.status})`, ms: 0 };
          if (res.status < 500) break;
        } catch {
          // network blip: retry
        }
        await new Promise((go) => setTimeout(go, 1200));
      }
      if (token.current === mine) setResults((cur) => ({ ...cur, [step]: r }));
    }));
    if (token.current === mine) setRunning(false);
  }, []);

  const done = Object.values(results);
  const problems = done.filter((r) => r.state === "error").length;
  const notes = done.filter((r) => r.state === "warn").length;

  return (
    <>
      <Button variant="secondary" onClick={() => { setOpen(true); void run(); }} title="Wake up and check every system"><Power className="h-4 w-4" />Wake up</Button>
      {open && (
        <Dialog title="Wake up" subtitle="Checks every system and fixes what it can" onClose={() => { token.current++; setOpen(false); }}>
          <ul className="divide-y divide-line">
            {STEPS.map(({ step, label }) => {
              const r = results[step];
              const m = r ? ICON[r.state] : null;
              return (
                <li key={step} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {m ? <m.Icon className={cx("h-4 w-4", m.cls)} aria-label={r.state} /> : <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Checking" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium leading-5 text-ink">{label}</span>
                    <span className="block text-[13px] leading-5 text-ink-2">{r ? r.detail : "Checking..."}</span>
                  </span>
                  {r && r.ms > 1500 && <span className="shrink-0 pt-0.5 text-[12px] tabular-nums text-ink-3">{(r.ms / 1000).toFixed(1)}s</span>}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p role="status" className="text-[13px] text-ink-2">
              {running ? "Working..." : problems ? `${problems} system${problems === 1 ? "" : "s"} need${problems === 1 ? "s" : ""} attention.` : notes ? "Up, with notes above." : "All systems are up."}
            </p>
            <Button variant="secondary" size="sm" onClick={run} disabled={running}>Run again</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
