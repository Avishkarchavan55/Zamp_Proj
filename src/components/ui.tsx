"use client";

import clsx from "clsx";
import {
  AlertTriangle, Ban, CheckCircle2, CircleDashed, CircleHelp, Clock3, Loader2, MinusCircle, XCircle,
} from "@/components/icons";
import { CHECK_META, STATUS_META, type Tone } from "@/lib/ui-meta";
import type { AppStatus, CheckStatus } from "@/lib/types";

export const cx = clsx;

/** Tags: a tinted fill with dark text of the same hue. No ring, no outline. */
const TONE: Record<Tone, string> = {
  good: "bg-good-soft text-good-ink",
  warn: "bg-warn-soft text-warn-ink",
  serious: "bg-serious-soft text-serious-ink",
  critical: "bg-critical-soft text-critical-ink",
  info: "bg-info-soft text-info-ink",
  neutral: "bg-line text-ink-2",
  brand: "bg-brand-soft text-brand-2",
};

export const DOT: Record<Tone, string> = {
  good: "bg-good", warn: "bg-warn", serious: "bg-serious", critical: "bg-critical", info: "bg-info",
  neutral: "bg-ink-3", brand: "bg-brand",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_ICON: Record<AppStatus, React.ElementType> = {
  processing: Loader2, approved: CheckCircle2, awaiting_vendor: Clock3, in_review: AlertTriangle, rejected: Ban,
};

/** An application's state: icon and label together, so it never relies on colour. */
export function StatusPill({ status, size = "sm" }: { status: AppStatus; size?: "sm" | "lg" }) {
  const meta = STATUS_META[status] ?? STATUS_META.processing;
  const Icon = STATUS_ICON[status] ?? CircleHelp;
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
      TONE[meta.tone], size === "lg" ? "h-7 px-3 text-[13px]" : "h-5 px-2 text-[12px]",
    )}>
      <Icon className={cx("h-3.5 w-3.5 shrink-0", status === "processing" && "animate-spin")} />
      {meta.label}
    </span>
  );
}

const CHECK_ICON: Record<CheckStatus, React.ElementType> = {
  passed: CheckCircle2, failed: XCircle, warning: AlertTriangle, unverified: CircleDashed, skipped: MinusCircle,
};
const CHECK_COLOR: Record<CheckStatus, string> = {
  passed: "text-good", failed: "text-critical", warning: "text-serious", unverified: "text-warn", skipped: "text-ink-3",
};

export function CheckIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const Icon = CHECK_ICON[status] ?? CircleHelp;
  return <Icon aria-label={CHECK_META[status]?.label} className={cx("h-4 w-4 shrink-0", CHECK_COLOR[status], className)} />;
}

export function CheckBadge({ status }: { status: CheckStatus }) {
  const m = CHECK_META[status];
  return <Badge tone={m.tone}><CheckIcon status={status} className="h-3 w-3" />{m.label}</Badge>;
}

/** A panel: white layer, hairline border, nothing else. Depth is the border, not a shadow. */
export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("min-w-0 rounded-md border border-line bg-surface", className)}>{children}</div>;
}

/** Panel title bar. The icon prop is accepted for older call sites but not drawn: titles carry the meaning. */
export function CardHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold leading-5 text-ink">{title}</h3>
        {subtitle && <p className="text-[12px] leading-4 text-ink-3">{subtitle}</p>}
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
        "btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]",
        variant === "primary" && "bg-action text-white hover:bg-action-2",
        variant === "secondary" && "border border-line-strong bg-transparent text-ink hover:bg-line-2",
        variant === "ghost" && "text-brand hover:bg-brand-soft",
        variant === "danger" && "bg-danger text-white hover:bg-danger-2",
        variant === "success" && "bg-success text-white hover:bg-success-2",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Page title block. `eyebrow` is metadata and renders under the title (a label above a heading is a tell). */
export function PageHeader({ title, subtitle, right, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em] text-ink">{title}</h1>
        {eyebrow && <div className="mt-0.5 text-[12px] leading-4 text-ink-3">{eyebrow}</div>}
        {subtitle && <div className="mt-1 max-w-3xl text-[14px] leading-5 text-ink-2">{subtitle}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Empty({ icon: Icon = CircleHelp, title, children }: { icon?: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="mb-2 h-5 w-5 text-ink-3" />
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[13px] leading-5 text-ink-3">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-sm bg-line", className)} />;
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[12px] tracking-normal", className)}>{children}</span>;
}

export function ago(iso: string | Date | null | undefined) {
  if (!iso) return "-";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function dateTime(iso: string | Date | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function clock(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const secs = (ms: number | null | undefined) => (ms == null ? "-" : `${(ms / 1000).toFixed(1)}s`);
