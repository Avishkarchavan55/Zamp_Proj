"use client";

import { CheckCircle2, FileUp, X } from "lucide-react";
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
        "relative flex min-h-[92px] items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors",
        file ? "cursor-default border-good/40 bg-good-soft/40" : "cursor-pointer border-line bg-surface hover:border-brand/50 hover:bg-brand-soft/30",
        drag && "border-brand bg-brand-soft/50",
        highlight && !file && "border-warn bg-warn-soft/40",
      )}
    >
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <div className={cx("rounded-lg p-2", file ? "bg-good-soft text-good-ink" : "bg-line-2 text-ink-3")}>
        {file ? <CheckCircle2 className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-ink">{label}{required && <span className="text-critical"> *</span>}</div>
        <div className="truncate text-xs text-ink-3">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : hint}</div>
      </div>
      {file && (
        <button type="button" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="rounded-lg p-1.5 text-ink-3 hover:bg-line-2">
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
