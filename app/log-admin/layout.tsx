import { redirect } from "next/navigation";

import { getCurrentLogAdmin } from "@/lib/admin-log-auth";

export default async function LogAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getCurrentLogAdmin();

  if (!admin) {
    redirect("/login");
  }

  return children;
}
