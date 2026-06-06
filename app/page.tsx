import { redirect } from "next/navigation";

import { getCurrentPerawat } from "@/lib/nurse-auth";
import { DARSI_PORTAL_URL } from "@/lib/portal-redirect";

export default async function HomePage() {
  const perawat = await getCurrentPerawat();

  if (perawat) {
    redirect("/dashboard");
  }

  redirect(DARSI_PORTAL_URL);
}
