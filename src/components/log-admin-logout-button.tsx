"use client";

import { useState } from "react";

import { logoutAdminLogClient } from "@/lib/logout-client";

export function LogAdminLogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        if (isLoading) return;
        setIsLoading(true);
        await logoutAdminLogClient();
      }}
      className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
    >
      {isLoading ? "Keluar..." : "Logout"}
    </button>
  );
}
