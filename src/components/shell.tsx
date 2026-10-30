"use client";

import { ExternalLink, FileStack, Inbox, LayoutDashboard, LogOut, Menu, ScaleIcon, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { CommandPalette } from "./command-palette";
import { cx } from "./ui";

export interface Me {
  name: string;
  email: string;
  role: "reviewer" | "controller";
  role_label: string;
  can_decide: boolean;
  can_override_rejection: boolean;
}
type AppRow = { status: string };

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/review", label: "Needs your decision", icon: UsersRound, badge: true },
  { href: "/applications", label: "All vendors", icon: FileStack },
  { href: "/outbox", label: "Emails to vendors", icon: Inbox },
  { href: "/policy", label: "How decisions are made", icon: ScaleIcon },
];

export function useMe() {
  return useSWR<Me>("/api/auth/me", { revalidateOnFocus: false });
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
        <ShieldCheck className="h-[18px] w-[18px]" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-white">VendorIQ</div>
        <div className="text-[11.5px] text-white/55">Acme Manufacturing</div>
      </div>
    </Link>
  );
}

function Sidebar({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: apps } = useSWR<AppRow[]>("/api/applications", { refreshInterval: 5000 });
  const { data: me } = useMe();
  const reviewCount = apps?.filter((a) => a.status === "in_review").length ?? 0;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex h-full flex-col gap-6 bg-navy px-3 py-5">
      <Logo />
      <button
        onClick={onSearch}
        className="mx-1 flex items-center gap-2 rounded-lg bg-white/8 px-3 py-2 text-[13.5px] text-white/60 transition-colors duration-150 hover:bg-white/12 hover:text-white"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Find a vendor</span>
        <kbd className="rounded border border-white/15 px-1.5 font-mono text-[10.5px]">Ctrl K</kbd>
      </button>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={cx(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors duration-150",
                active ? "bg-white/12 font-medium text-white" : "text-white/70 hover:bg-white/6 hover:text-white",
              )}
            >
              <n.icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{n.label}</span>
              {n.badge && reviewCount > 0 && <span className="rounded-full bg-serious px-2 py-0.5 text-[11.5px] font-semibold text-white">{reviewCount}</span>}
            </Link>
          );
        })}
        <div className="my-3 border-t border-white/10" />
        <Link href="/apply" target="_blank" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-white/70 transition-colors duration-150 hover:bg-white/6 hover:text-white">
          <ExternalLink className="h-[18px] w-[18px]" />
          <span className="flex-1">Supplier portal</span>
        </Link>
      </nav>

      <div className="flex items-center gap-2.5 rounded-xl bg-white/6 p-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white">
          {me?.name.split(" ").map((p) => p[0]).join("").slice(0, 2) ?? "…"}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13.5px] font-medium text-white">{me?.name ?? "…"}</div>
          <div className="truncate text-[11.5px] text-white/55">{me?.role_label}</div>
        </div>
        <button onClick={signOut} aria-label="Sign out" title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
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
        <Sidebar onSearch={() => setPalette(true)} />
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10" aria-label="Search" onClick={() => setPalette(true)}><Search className="h-5 w-5" /></button>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-pop">
            <button className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} onSearch={() => { setOpen(false); setPalette(true); }} />
          </aside>
        </div>
      )}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
