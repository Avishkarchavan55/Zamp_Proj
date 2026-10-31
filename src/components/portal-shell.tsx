"use client";

import { ShieldCheck } from "@/components/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { ThemeToggle } from "./theme-toggle";
import { ScrollToTop } from "./page-nav";
import { cx } from "./ui";

const NAV = [
  { href: "/portal", label: "Supplier portal", exact: true },
  { href: "/portal/become-a-supplier", label: "Become a supplier" },
  { href: "/portal/notifications", label: "Notifications", badge: true },
];

/**
 * The supplier-facing frame: a top bar rather than the company sidebar, so the two portals are
 * recognisably different places. Suppliers see their own applications and notifications, nothing else.
 */
export function PortalShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSWR<{ unread: number }>("/api/supplier/portal", { refreshInterval: 15000 });

  async function signOut() {
    await fetch("/api/supplier/logout", { method: "POST" });
    router.replace("/login?portal=supplier");
  }

  return (
    <div className="min-h-viewport">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-action text-white"><ShieldCheck className="h-4 w-4" /></span>
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold text-ink">Acme Manufacturing</span>
              <span className="hidden text-[12px] text-ink-3 sm:block">Supplier portal</span>
            </span>
          </Link>
          <nav aria-label="Supplier portal" className="ml-4 hidden h-full items-stretch gap-5 md:flex">
            {NAV.map((n) => <NavItem key={n.href} {...n} pathname={pathname} unread={n.badge ? data?.unread : undefined} />)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden max-w-[200px] truncate text-[13px] text-ink-2 sm:block" title={email}>{email}</span>
            <button onClick={signOut} className="h-8 rounded-md border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-line-2">Sign out</button>
          </div>
        </div>
        <nav aria-label="Supplier portal" className="scrollbar-thin flex gap-5 overflow-x-auto border-t border-line px-4 md:hidden">
          {NAV.map((n) => <NavItem key={n.href} {...n} pathname={pathname} unread={n.badge ? data?.unread : undefined} />)}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      <footer className="pb-8 text-center text-[12px] text-ink-3">Verification powered by VendorIQ</footer>
      <ScrollToTop />
    </div>
  );
}

function NavItem({ href, label, exact, pathname, unread }: { href: string; label: string; exact?: boolean; pathname: string; unread?: number }) {
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx("inline-flex h-full min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] transition-colors duration-150", active ? "border-brand font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink")}
    >
      {label}
      {unread ? <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[11px] font-semibold leading-none text-white">{unread > 9 ? "9+" : unread}</span> : null}
    </Link>
  );
}
