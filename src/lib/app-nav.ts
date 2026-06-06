import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  ClipboardList,
  LayoutDashboard,
  Users,
  Zap,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  match?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Ringkasan operasional perawat",
    icon: LayoutDashboard,
  },
  {
    href: "/pasien",
    label: "Manajemen Pasien",
    description: "Data pasien terintegrasi",
    icon: Users,
    match: ["/pasien", "/tambah-pasien"],
  },
  {
    href: "/triage-igd",
    label: "Triage IGD",
    description: "Prioritas dan penanganan IGD",
    icon: Zap,
  },
  {
    href: "#",
    label: "Catatan Pasien",
    description: "Dokumentasi klinis pasien",
    icon: ClipboardList,
  },
  {
    href: "#",
    label: "Klaim & Resume",
    description: "Ringkasan medis dan klaim",
    icon: CircleCheck,
  },
];

export function getActiveNavItem(pathname: string): NavItem {
  for (const item of NAV_ITEMS) {
    const paths = item.match ?? [item.href];
    if (paths.some((path) => path !== "#" && (pathname === path || pathname.startsWith(`${path}/`)))) {
      return item;
    }
  }

  return NAV_ITEMS[0];
}
