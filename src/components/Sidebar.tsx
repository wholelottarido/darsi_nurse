"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleCheck,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  match?: string[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "OPERASIONAL",
    items: [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        label: "Overview",
      },
      {
        href: "/pasien",
        icon: Users,
        label: "Manajemen Pasien",
        match: ["/pasien", "/tambah-pasien"],
      },
    ],
  },
  {
    label: "KLINIS",
    items: [
      {
        href: "/triage-igd",
        icon: Zap,
        label: "Triage IGD",
      },
      {
        href: "#",
        icon: ClipboardList,
        label: "Catatan Pasien",
      },
      {
        href: "#",
        icon: CircleCheck,
        label: "Klaim & Resume",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (item: NavItem) => {
    const paths = item.match ?? [item.href];
    return paths.some((path) => pathname === path || pathname.startsWith(path + "/"));
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item);

    return (
      <Link
        key={item.label}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-2xl border text-sm font-bold transition-all",
          collapsed ? "justify-center px-0" : "px-3",
          active
            ? "border-[#b7f7d4] bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.55)]"
            : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <Icon className="size-5 shrink-0" />
        {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-shrink-0 bg-gradient-to-b from-slate-50 to-white p-4 transition-[width] duration-300",
        collapsed ? "w-24" : "w-72"
      )}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <div
          className={cn(
            "flex items-center border-b border-slate-100 bg-gradient-to-r from-[#f8fffb] to-white px-4",
            collapsed ? "h-24 flex-col justify-center gap-2" : "h-20 justify-between gap-3"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
              <Image
                src="/logo.png"
                alt="DARSI Nurse"
                width={40}
                height={40}
                className="h-full w-full object-contain p-1"
                priority
              />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-extrabold leading-tight tracking-wider text-[#064E3B]">
                  DARSI
                </h1>
                <p className="text-[0.6rem] font-medium uppercase tracking-widest text-slate-400">
                  Digital Assistant for Nurse
                </p>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {!collapsed && (
            <p className="mb-4 text-xs font-bold tracking-[0.24em] text-slate-400">
              MENU UTAMA
            </p>
          )}

          <div className="space-y-7">
            {navSections.map((section, index) =>
              collapsed ? (
                <div
                  key={section.label}
                  className={cn("space-y-2", index > 0 && "border-t border-slate-100 pt-5")}
                >
                  {section.items.map(renderNavItem)}
                </div>
              ) : (
                <Collapsible key={section.label} defaultOpen className="space-y-2 rounded-2xl bg-slate-50/40 p-3">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-xl px-1 text-xs font-bold tracking-[0.24em] text-slate-400 transition-colors hover:text-[#059669]">
                    <span>{section.label}</span>
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2">
                    {section.items.map(renderNavItem)}
                  </CollapsibleContent>
                </Collapsible>
              )
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
