"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";

import MobileSidebarSheet from "@/components/layout/MobileSidebarSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getActiveNavItem } from "@/lib/navigation/app-nav";
import { logoutNurseClient } from "@/lib/auth/logout-client";
import type { PerawatSession } from "@/lib/auth/nurse-auth";

type HeaderProps = {
  perawat: PerawatSession;
  collapsed: boolean;
  onToggleSidebar: () => void;
};

export default function Header({ perawat, collapsed, onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const activeItem = getActiveNavItem(pathname);
  const ActiveIcon = activeItem.icon;

  return (
    <header className="rounded-t-2xl rounded-b-none border border-slate-300 bg-white px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MobileSidebarSheet perawat={perawat} />

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden h-8 w-8 border-slate-300 text-slate-600 hover:bg-slate-100 md:inline-flex"
            onClick={onToggleSidebar}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ActiveIcon className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">{activeItem.label}</p>
            <p className="text-xs text-slate-600">{activeItem.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden w-56 lg:block xl:w-72">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              type="text"
              placeholder="Cari pasien..."
              className="h-8 rounded-lg pl-9 text-sm"
            />
          </div>

          <span className="hidden rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 sm:inline">
            Perawat
          </span>

          <ThemeToggle />

          <Button
            variant="outline"
            size="sm"
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
            onClick={() => void logoutNurseClient()}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
