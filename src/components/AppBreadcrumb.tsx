"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = {
  href?: string;
  label: string;
};

function getBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/" || pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  const breadcrumbs: Crumb[] = [{ href: "/dashboard", label: "Dashboard" }];

  if (pathname.startsWith("/pasien")) {
    breadcrumbs.push({ label: "Manajemen Pasien" });
    return breadcrumbs;
  }

  if (pathname.startsWith("/tambah-pasien")) {
    breadcrumbs.push(
      { href: "/pasien", label: "Manajemen Pasien" },
      { label: "Tambah Pasien" }
    );
    return breadcrumbs;
  }

  if (pathname.startsWith("/triage-igd")) {
    breadcrumbs.push({ href: "/triage-igd", label: "Triage IGD" });

    if (pathname !== "/triage-igd") {
      breadcrumbs.push({ label: "Detail Pasien" });
    } else {
      breadcrumbs[breadcrumbs.length - 1] = { label: "Triage IGD" };
    }

    return breadcrumbs;
  }

  breadcrumbs.push({ label: "Halaman" });
  return breadcrumbs;
}

export default function AppBreadcrumb() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2.5 md:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((breadcrumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <Fragment key={`${breadcrumb.label}-${index}`}>
                <BreadcrumbItem>
                  {breadcrumb.href && !isLast ? (
                    <BreadcrumbLink asChild>
                      <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
