"use client";

import { Moon, Sun } from "@/components/icons";
import { useSyncExternalStore } from "react";
import { cx } from "./ui";

const KEY = "vendoriq.theme";

/**
 * Runs before first paint (inlined in <head>): applies the saved theme, else the OS preference,
 * so a dark-mode visitor never sees a white flash.
 */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`;

/** The theme lives on <html data-theme>; every toggle on the page follows it. */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const current = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

/** Light / dark switch. `tone="side"` inside the sidebar, default on page surfaces. */
export function ThemeToggle({ tone = "surface", className }: { tone?: "surface" | "side"; className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, () => null);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private mode: the choice lasts for this page only
    }
  };
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150",
        tone === "side" ? "text-side-ink-2 hover:bg-side-hover hover:text-side-ink" : "border border-line text-ink-2 hover:bg-line-2 hover:text-ink",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
