"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/dashboard/actions";
import { cn } from "cn";

const links = [
  { href: "/dashboard", label: "Dashboard", short: "Home", exact: true },
  { href: "/members", label: "Members", short: "Members" },
  { href: "/birthdays", label: "Calendar", short: "Calendar" },
  { href: "/celebrations", label: "Celebrations", short: "Celebrate" },
  { href: "/departments", label: "Departments", short: "Departments" },
  { href: "/groups", label: "Groups", short: "Groups" },
  { href: "/registrations", label: "Registrations", short: "Registrations" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const menu = menuRef.current;
    const desktop = window.matchMedia("(min-width: 768px)");

    function sync() {
      if (!menu) {
        return;
      }

      const hidden = !desktop.matches && !open;
      menu.inert = hidden;
      menu.setAttribute("aria-hidden", hidden ? "true" : "false");
    }

    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="app-shell min-h-dvh">
      <div className="md:grid md:min-h-dvh md:grid-cols-[15.5rem_minmax(0,1fr)]">
        <button
          type="button"
          className={cn(
            "fixed inset-0 z-40 bg-[#0b1220]/50 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-label="Close menu"
          aria-hidden={open ? undefined : true}
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            menuButtonRef.current?.focus();
          }}
        />
        <aside
          ref={menuRef}
          id="app-menu"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] -translate-x-full flex-col overflow-y-auto overscroll-contain bg-[#0e1730] px-3 py-4 text-white shadow-[12px_0_32px_-18px_rgba(0,0,0,0.65)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:sticky md:top-0 md:z-auto md:h-dvh md:w-auto md:translate-x-0 md:shadow-none",
            open && "translate-x-0"
          )}
        >
          <div className="flex items-center justify-between px-2 pb-4">
            <p className="text-lg font-semibold tracking-tight">Celebrations</p>
            <button
              ref={closeButtonRef}
              type="button"
              className="flex h-11 items-center rounded-xl px-3 text-sm font-semibold md:hidden"
              onClick={() => {
                setOpen(false);
                menuButtonRef.current?.focus();
              }}
            >
              Close
            </button>
          </div>
          <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
            {links.map((link) => {
              const active = isActive(pathname, link.href, link.exact);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex h-11 items-center rounded-xl bg-[#315efb] px-3 text-sm font-semibold text-white"
                      : "flex h-11 items-center rounded-xl px-3 text-sm font-medium text-[#c9d4ea] hover:bg-white/10"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[#e6ebf2] bg-white px-3">
            <button
              ref={menuButtonRef}
              type="button"
              className="flex size-11 items-center justify-center rounded-xl text-[#142033] md:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="app-menu"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <p className="text-sm font-semibold md:hidden">Celebrations</p>
            <form action={logout} className="ml-auto">
              <button
                type="submit"
                className="flex h-9 items-center rounded-xl px-3 text-sm font-medium text-[#52657a] ring-1 ring-[#e2e8f0]"
              >
                Sign out
              </button>
            </form>
          </header>
          <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </div>
        </div>
      </div>
      <nav
        aria-label="Shortcuts"
        className="fixed inset-x-3 z-30 md:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <ul className="grid grid-cols-4 rounded-2xl bg-white p-1 shadow-[0_12px_30px_-16px_rgba(14,23,48,0.45)] ring-1 ring-[#e2e8f0]">
          {links.slice(0, 4).map((link) => {
            const active = isActive(pathname, link.href, link.exact);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex h-11 items-center justify-center rounded-xl bg-[#315efb] px-1 text-center text-[11px] font-semibold text-white"
                      : "flex h-11 items-center justify-center rounded-xl px-1 text-center text-[11px] font-medium text-[#52657a]"
                  }
                >
                  {link.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
