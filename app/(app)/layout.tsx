import { redirect } from "next/navigation";

import Sidebar from "../../src/components/Sidebar";
import Header from "../../src/components/Header";
import AppBreadcrumb from "../../src/components/AppBreadcrumb";
import { getCurrentPerawat } from "../../src/lib/nurse-auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const perawat = await getCurrentPerawat();

  if (!perawat) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <section className="flex min-w-0 flex-1 p-4 lg:pl-0">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
          <Header perawat={perawat} />
          <AppBreadcrumb />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </section>
    </div>
  );
}
