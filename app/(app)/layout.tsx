import { redirect } from "next/navigation";

import AppShell from "../../src/components/AppShell";
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

  return <AppShell perawat={perawat}>{children}</AppShell>;
}
