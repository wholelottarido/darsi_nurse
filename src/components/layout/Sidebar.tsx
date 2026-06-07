"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import StaffProfileMenu from "@/components/layout/StaffProfileMenu";
import { Logo } from "@/components/layout/logo";
import { NAV_ITEMS } from "@/lib/navigation/app-nav";
import { logoutNurseClient } from "@/lib/auth/logout-client";
import type { PerawatSession } from "@/lib/auth/nurse-auth";
import { cn } from "@/lib/utils/utils";

type SidebarProps = {
  perawat: PerawatSession;
  collapsed?: boolean;
  className?: string;
};

export default function Sidebar({ perawat, collapsed = false, className }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, match?: string[]) => {
    const paths = match ?? [href];
    return paths.some(
      (path) => path !== "#" && (pathname === path || pathname.startsWith(`${path}/`))
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white",
        collapsed ? "w-[84px]" : "w-[250px]",
        className
      )}
    >
      <div className={cn("border-b border-slate-300", collapsed ? "px-2 py-4" : "px-4 py-5")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Logo size={26} />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.04em] text-slate-800">
                DARSI Nurse
              </p>
              <p className="text-[11px] uppercase tracking-[0.1em] text-emerald-800">
                Clinical Care Workspace
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div className="px-4 pt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          Menu Perawat
        </div>
      ) : null}

      <nav className={cn("flex-1 overflow-y-auto", collapsed ? "px-2 py-4" : "px-3 py-3")}>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.match);

            if (item.href === "#") {
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled
                  className={cn(
                    "flex w-full cursor-not-allowed items-center rounded-lg text-slate-400 opacity-60",
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2 text-left text-sm font-medium"
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg text-slate-600 transition",
                  collapsed
                    ? "justify-center px-0 py-2.5 hover:text-slate-900"
                    : "gap-3 px-3 py-2 text-left text-sm font-medium hover:bg-slate-100 hover:text-slate-900",
                  active &&
                    (collapsed ? "text-emerald-800" : "bg-emerald-100/70 text-emerald-800")
                )}
                aria-label={item.label}
              >
                <span
                  className={cn(
                    "flex items-center justify-center",
                    collapsed && active && "h-7 w-7 rounded-md bg-emerald-200/90 text-emerald-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={cn("mt-auto border-t border-slate-300 p-4", collapsed && "px-2 py-3")}>
        <StaffProfileMenu
          fullName={perawat.namaLengkap}
          username={perawat.username}
          roleLabel={`Perawat · ${perawat.status}`}
          isSidebarCollapsed={collapsed}
          onLogout={() => void logoutNurseClient()}
        />
      </div>
    </aside>
  );
}
