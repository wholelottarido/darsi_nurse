import { redirect } from "next/navigation";

import { getCurrentLogAdmin } from "@/lib/auth/admin-log-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
