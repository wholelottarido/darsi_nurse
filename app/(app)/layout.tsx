import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import { getCurrentPerawat } from "@/lib/auth/nurse-auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const perawat = await getCurrentPerawat();

  if (!perawat) {
    redirect("/login");
  }

  return <AppShell perawat={perawat}>{children}</AppShell>;
}
