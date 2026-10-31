"use client";

import { FileStack, Inbox, InformationIcon, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, UsersRound, X } from "@/components/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { AppListRow } from "./api-types";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { ScrollToTop } from "./page-nav";
import { ThemeToggle } from "./theme-toggle";
import { needsAttention } from "@/lib/attention";
import { cx } from "./ui";

export interface Me {
  name: string;
  email: string;
  role: "reviewer" | "controller";
  role_label: string;
  can_decide: boolean;
  can_override_rejection: boolean;
}

/** The same names are used in the command palette, page titles and empty states. */
export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/applications", label: "All vendors", icon: FileStack },
  { href: "/review", label: "Needs attention", icon: UsersRound, badge: true },
  { href: "/outbox", label: "Emails to vendors", icon: Inbox },
  { href: "/info", label: "Info", icon: InformationIcon },
];

export function useMe() {
  return useSWR<Me>("/api/auth/me", { revalidateOnFocus: false });
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-action text-white">
        <ShieldCheck className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold text-side-ink">VendorIQ</span>
        <span className="block text-[12px] text-side-ink-2">Acme Manufacturing</span>
      </span>
    </Link>
  );
}

function NavLink({ href, label, icon: Icon, active, badge, onNavigate }: {
  href: string; label: string; icon: React.ElementType; active?: boolean; badge?: number; onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-9 items-center gap-3 rounded-md border px-3 text-[14px] transition-colors duration-150",
        active
          ? "border-side-line bg-side-active font-semibold text-side-ink"
          : "border-transparent text-side-ink-2 hover:bg-side-hover hover:text-side-ink",
      )}
    >
      <Icon className={cx("h-4 w-4 shrink-0", active && "text-brand")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-serious-soft px-1.5 text-[12px] font-semibold tabular-nums text-serious-ink">{badge}</span> : null}
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: apps } = useSWR<AppListRow[]>("/api/applications", { refreshInterval: 5000 });
  const reviewCount = apps?.filter(needsAttention).length ?? 0;
  return (
    <div className="flex h-full flex-col border-r border-side-line bg-side">
      <div className="flex h-12 shrink-0 items-center border-b border-side-line px-4">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.href} href={n.href} label={n.label} icon={n.icon} onNavigate={onNavigate}
            active={n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)}
            badge={n.badge ? reviewCount : undefined}
          />
        ))}
      </nav>
    </div>
  );
}

function UserMenu() {
  const router = useRouter();
  const { data: me } = useMe();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  const initials = me?.name.split(" ").map((p) => p[0]).join("").slice(0, 2) ?? "";
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-[12px] font-semibold text-ink-2">{initials}</span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-[13px] font-medium text-ink">{me?.name ?? ""}</span>
        <span className="block text-[12px] text-ink-3">{me?.role_label ?? ""}</span>
      </span>
      <button onClick={signOut} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-line-2 hover:text-ink">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="min-h-viewport lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8">
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-line-2 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
        <span className="lg:hidden"><Logo /></span>
        <button
          onClick={() => setPalette(true)}
          className="hidden h-8 w-full max-w-sm items-center gap-2 border-b border-line-strong bg-field px-3 text-left text-[13px] text-ink-3 transition-colors duration-150 hover:text-ink md:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1">Search vendors and pages</span>
          <kbd className="font-mono text-[12px] text-ink-3">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-line-2 md:hidden" aria-label="Search" onClick={() => setPalette(true)}>
            <Search className="h-4 w-4" />
          </button>
          <NotificationBell />
          <ThemeToggle />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <UserMenu />
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-pop">
            <button className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-side-ink-2 hover:bg-side-hover" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <ScrollToTop />
    </div>
  );
}
