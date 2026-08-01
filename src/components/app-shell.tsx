"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Puzzle,
  Settings,
  Sun,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { APP_NAME } from "@/lib/branding";

const NAV_SECTIONS = [
  {
    title: "Platform",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        isActive: (p: string) => p.startsWith("/dashboard"),
      },
      {
        href: "/content",
        label: "Biblioteca",
        icon: FolderKanban,
        isActive: (p: string) => p.startsWith("/content"),
        hasSubmenu: true,
      },
      {
        href: "/calendar",
        label: "Calendario",
        icon: CalendarDays,
        isActive: (p: string) => p.startsWith("/calendar"),
        hasSubmenu: true,
      },
      {
        href: "/audience",
        label: "Público",
        icon: Users2,
        isActive: (p: string) => p.startsWith("/audience"),
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        href: "/agents",
        label: "Agentes",
        icon: Puzzle,
        isActive: (p: string) => p.startsWith("/agents"),
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        href: "/account",
        label: "Settings",
        icon: Settings,
        isActive: (p: string) => p.startsWith("/account"),
        hasSubmenu: true,
      },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "content-os.sidebar-hidden";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarHidden));
    } catch {}
  }, [sidebarHidden]);

  if (pathname === "/login") {
    return (
      <main className="min-h-screen bg-background">
        {children}
      </main>
    );
  }

  const allNavItems = NAV_SECTIONS.flatMap((s) => s.items);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar lg:flex",
          "border-r border-sidebar-border transition-[width] duration-[220ms] ease-[cubic-bezier(0.32,0,0.16,1)]",
          sidebarHidden ? "w-0 overflow-hidden opacity-0" : "w-[200px]",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex size-7 items-center justify-center">
            {/* Neutral placeholder mark — swap it for your own logo. */}
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              role="img"
              aria-label={APP_NAME}
            >
              <circle
                cx="12"
                cy="12"
                r="8.7"
                stroke="var(--brand)"
                strokeWidth="2.6"
              />
            </svg>
          </div>
          <span className="font-semibold text-foreground">{APP_NAME}</span>
          <ChevronDown className="ml-auto size-4 text-muted-foreground" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="mb-2 px-3 text-label font-medium uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
              <ul className="space-y-0">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(pathname);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-surface-elevated text-foreground"
                            : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                        {"hasSubmenu" in item && item.hasSubmenu ? (
                          <ChevronRight className="ml-auto size-4" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-sidebar-border px-3 py-4">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Salir</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
          {sidebarHidden ? (
            <button
              type="button"
              onClick={() => setSidebarHidden(false)}
              className="hidden lg:flex size-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
              aria-label="Mostrar navegación"
            >
              <PanelRightOpen className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarHidden(true)}
              className="hidden lg:flex size-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
              aria-label="Ocultar navegación"
            >
              <PanelRightClose className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            className="ml-auto flex size-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-6 border-t border-sidebar-border bg-sidebar lg:hidden">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[62px] flex-col items-center justify-center gap-1 px-1 text-center transition",
                active ? "bg-surface-elevated text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              <span className="max-w-full truncate font-mono text-micro uppercase tracking-label">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
