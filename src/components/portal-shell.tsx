"use client";

import { Bell, FileStack, LogOut, Menu, QrCode, ShieldCheck, X } from "@/components/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ThemeToggle } from "./theme-toggle";
import { ScrollToTop } from "./page-nav";
import { cx } from "./ui";

const NAV = [
  { href: "/portal", label: "Supplier portal", icon: FileStack, exact: true },
  { href: "/portal/become-a-supplier", label: "Become a supplier", icon: QrCode },
  { href: "/portal/notifications", label: "Notifications", icon: Bell, badge: true },
];

function Logo() {
  return (
    <Link href="/portal" className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-action text-white"><ShieldCheck className="h-4 w-4" /></span>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold text-side-ink">VendorIQ</span>
        <span className="block text-[12px] text-side-ink-2">Supplier portal</span>
      </span>
    </Link>
  );
}

function Sidebar({ unread, onNavigate }: { unread?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col border-r border-side-line bg-side">
      <div className="flex h-12 shrink-0 items-center border-b border-side-line px-4"><Logo /></div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Supplier portal">
        {NAV.map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-9 items-center gap-3 rounded-md border px-3 text-[14px] transition-colors duration-150",
                active ? "border-side-line bg-side-active font-semibold text-side-ink" : "border-transparent text-side-ink-2 hover:bg-side-hover hover:text-side-ink",
              )}
            >
              <n.icon className={cx("h-4 w-4 shrink-0", active && "text-brand")} />
              <span className="min-w-0 flex-1 truncate">{n.label}</span>
              {n.badge && unread ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[12px] font-semibold tabular-nums text-white">{unread > 9 ? "9+" : unread}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** The supplier-facing frame: the same sidebar layout as the company portal, with only the supplier's own pages. */
export function PortalShell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useSWR<{ unread: number }>("/api/supplier/portal", { refreshInterval: 15000 });

  async function signOut() {
    await fetch("/api/supplier/logout", { method: "POST" });
    router.replace("/login?portal=supplier");
  }

  return (
    <div className="min-h-viewport lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block"><Sidebar unread={data?.unread} /></aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8">
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-line-2 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
        <span className="lg:hidden"><Logo /></span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/portal/notifications" aria-label="Notifications" title="Notifications" className="relative flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-line-2 hover:text-ink">
            <Bell className="h-4 w-4" />
            {data?.unread ? <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[11px] font-semibold leading-none text-white">{data.unread > 9 ? "9+" : data.unread}</span> : null}
          </Link>
          <ThemeToggle />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <span className="hidden max-w-[220px] truncate text-[13px] text-ink-2 sm:block" title={email}>{email}</span>
          <button onClick={signOut} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-line-2 hover:text-ink">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-pop">
            <button className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md text-side-ink-2 hover:bg-side-hover" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
            <Sidebar unread={data?.unread} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <ScrollToTop />
    </div>
  );
}
