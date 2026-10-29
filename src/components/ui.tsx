"use client";

import clsx from "clsx";
import {
  AlertTriangle, Ban, CheckCircle2, CircleDashed, CircleHelp, Clock3, Loader2, MinusCircle, XCircle,
} from "lucide-react";
import { CHECK_META, STATUS_META, type Tone } from "@/lib/ui-meta";
import type { AppStatus, CheckStatus } from "@/lib/types";

export const cx = clsx;

const TONE: Record<Tone, string> = {
  good: "bg-good-soft text-good-ink ring-good/25",
  warn: "bg-warn-soft text-warn-ink ring-warn/35",
  serious: "bg-serious-soft text-serious-ink ring-serious/30",
  critical: "bg-critical-soft text-critical-ink ring-critical/25",
  info: "bg-info-soft text-info-ink ring-info/25",
  neutral: "bg-line-2 text-ink-2 ring-line",
  brand: "bg-brand-soft text-brand-2 ring-brand/20",
};

export const DOT: Record<Tone, string> = {
  good: "bg-good", warn: "bg-warn", serious: "bg-serious", critical: "bg-critical", info: "bg-info",
  neutral: "bg-ink-3", brand: "bg-brand",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", TONE[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_ICON: Record<AppStatus, React.ElementType> = {
  processing: Loader2, approved: CheckCircle2, awaiting_vendor: Clock3, in_review: AlertTriangle, rejected: Ban,
};

export function StatusPill({ status, size = "sm" }: { status: AppStatus; size?: "sm" | "lg" }) {
  const meta = STATUS_META[status] ?? STATUS_META.processing;
  const Icon = STATUS_ICON[status] ?? CircleHelp;
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
      TONE[meta.tone], size === "lg" ? "px-3 py-1 text-[14px]" : "px-2 py-0.5 text-[12px]",
    )}>
      <Icon className={cx(size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5", status === "processing" && "animate-spin")} />
      {meta.label}
    </span>
  );
}

const CHECK_ICON: Record<CheckStatus, React.ElementType> = {
  passed: CheckCircle2, failed: XCircle, warning: AlertTriangle, unverified: CircleDashed, skipped: MinusCircle,
};
const CHECK_COLOR: Record<CheckStatus, string> = {
  passed: "text-good", failed: "text-critical", warning: "text-serious", unverified: "text-warn-ink", skipped: "text-ink-3",
};

export function CheckIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const Icon = CHECK_ICON[status] ?? CircleHelp;
  return <Icon aria-label={CHECK_META[status]?.label} className={cx("h-4 w-4 shrink-0", CHECK_COLOR[status], className)} />;
}

export function CheckBadge({ status }: { status: CheckStatus }) {
  const m = CHECK_META[status];
  return <Badge tone={m.tone}><CheckIcon status={status} className="h-3 w-3" />{m.label}</Badge>;
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, right, icon: Icon }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {Icon && <Icon className="h-4 w-4 text-ink-3" />}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({
  variant = "primary", size = "md", className, children, loading, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "min-h-9 px-3 text-[13.5px]" : "min-h-10 px-4 text-[14px]",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-line-2",
        variant === "ghost" && "text-ink-2 hover:bg-line-2 hover:text-ink",
        variant === "danger" && "bg-critical text-white hover:bg-critical-ink",
        variant === "success" && "bg-good text-white hover:bg-good-ink",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, right, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] text-ink-3">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <div className="mt-1.5 max-w-3xl text-[15px] text-ink-2">{subtitle}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Empty({ icon: Icon = CircleHelp, title, children }: { icon?: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-line-2 p-3"><Icon className="h-5 w-5 text-ink-3" /></div>
      <div className="text-sm font-medium text-ink">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-line-2", className)} />;
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[12.5px]", className)}>{children}</span>;
}

export function ago(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function dateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function clock(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const secs = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);
