"use client";

import { CheckCircle2, FileUp, X } from "@/components/icons";
import { useRef, useState } from "react";
import { cx } from "./ui";

export function FileSlot({
  label, hint, required, file, onChange, highlight,
}: {
  label: string;
  hint: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  highlight?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
      onClick={() => !file && input.current?.click()}
      className={cx(
        // min-w-0: a long hint must truncate, never widen the page (it did on phones)
        "relative flex min-h-[72px] min-w-0 items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-150",
        file ? "cursor-default border-solid border-good bg-good-soft" : "cursor-pointer border-dashed border-line-strong bg-surface hover:bg-line-2",
        drag && "border-brand bg-brand-soft",
        highlight && !file && "border-warn bg-warn-soft",
      )}
    >
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {file ? <CheckCircle2 className="h-5 w-5 shrink-0 text-good" /> : <FileUp className="h-5 w-5 shrink-0 text-ink-3" />}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{label}{required && <span className="text-critical"> *</span>}</div>
        <div className="truncate text-[12px] text-ink-3">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : hint}</div>
      </div>
      {file && (
        <button type="button" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="rounded-md p-1.5 text-ink-3 transition-colors duration-150 hover:bg-line-2 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export async function fetchAsFile(url: string, name: string): Promise<File> {
  const blob = await fetch(url).then((r) => r.blob());
  const type = name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".png") ? "image/png" : "image/jpeg";
  return new File([blob], name, { type });
}
