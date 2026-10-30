"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

/** Copies a link to the clipboard and confirms for two seconds. */
export function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13.5px] font-medium text-white hover:bg-brand-2"
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : label}
    </button>
  );
}
