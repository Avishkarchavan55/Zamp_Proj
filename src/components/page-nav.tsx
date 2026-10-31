"use client";

import { ArrowLeft, ArrowUp } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cx } from "./ui";

const noop = () => () => {};

/**
 * Goes back to wherever the user came from. Opened directly (new tab, link from an email)
 * there is nothing to go back to, so it goes to `fallback` instead.
 */
export function BackButton({ fallback, label = "Back", className }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  const canGoBack = useSyncExternalStore(noop, () => window.history.length > 1, () => false);
  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.back() : router.push(fallback))}
      className={cx("inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink", className)}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Floating "back to top" button for long pages; appears once the reader is well down the page. */
export function ScrollToTop({ after = 700 }: { after?: number }) {
  const show = useSyncExternalStore(subscribeScroll, () => window.scrollY > after, () => false);
  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className={cx(
        "fixed bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 shadow-pop transition-all duration-200 hover:text-brand",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
