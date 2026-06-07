"use client";

import { useState } from "react";

import AppBreadcrumb from "@/components/layout/AppBreadcrumb";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import type { PerawatSession } from "@/lib/auth/nurse-auth";
import { cn } from "@/lib/utils/utils";

type AppShellProps = {
  perawat: PerawatSession;
  children: React.ReactNode;
};

export default function AppShell({ perawat, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="h-dvh w-screen overflow-hidden bg-emerald-100/70 p-2 text-foreground md:p-3">
      <div
        className={cn(
          "grid h-full w-full transition-[grid-template-columns,gap] duration-300",
          collapsed
            ? "gap-2 md:grid-cols-[84px_minmax(0,1fr)] md:gap-3"
            : "gap-2 md:grid-cols-[250px_minmax(0,1fr)] md:gap-3"
        )}
      >
        <div className="hidden h-full min-h-0 md:block">
          <Sidebar perawat={perawat} collapsed={collapsed} className="h-full" />
        </div>

        <section className="flex h-full min-h-0 min-w-0 flex-col gap-0.5">
          <Header
            perawat={perawat}
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((value) => !value)}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl rounded-t-none border border-slate-300 bg-slate-50">
            <AppBreadcrumb />
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
