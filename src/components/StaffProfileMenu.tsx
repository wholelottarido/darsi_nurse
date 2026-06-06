"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

type StaffProfileMenuProps = {
  fullName?: string | null;
  username?: string | null;
  roleLabel?: string;
  isSidebarCollapsed?: boolean;
  onLogout: () => void;
};

function getInitials(name: string, username: string): string {
  const fromName = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  if (fromName.length >= 2) return fromName;
  if (username) return username.slice(0, 2).toUpperCase();
  return "NR";
}

export default function StaffProfileMenu({
  fullName,
  username,
  roleLabel = "Perawat",
  isSidebarCollapsed = false,
  onLogout,
}: StaffProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayName = fullName?.trim() || username?.trim() || "Perawat";
  const displayUsername = username?.trim() || "-";
  const initials = getInitials(displayName, displayUsername);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", isSidebarCollapsed && "flex justify-center")}>
      {open ? (
        <div
          className={cn(
            "absolute z-50 mb-2 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg",
            isSidebarCollapsed ? "bottom-0 left-full ml-2 w-64" : "bottom-full left-0 right-0"
          )}
        >
          <div className="border-b border-slate-100 px-3 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{displayUsername}</p>
            <p className="mt-1 text-[11px] font-medium text-emerald-800">{roleLabel}</p>
          </div>

          <div className="border-t border-slate-100 p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-4 w-4 shrink-0 text-slate-500" />
              Log out
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center rounded-lg border border-transparent transition",
          open ? "border-slate-300 bg-slate-100" : "hover:border-slate-300 hover:bg-slate-100",
          isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-2 py-2 text-left"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
          {initials}
        </span>
        {!isSidebarCollapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {displayName}
              </span>
              <span className="block truncate text-[11px] text-slate-500">Profil Saya</span>
            </span>
            <ChevronUp
              className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")}
            />
          </>
        ) : null}
      </button>
    </div>
  );
}
