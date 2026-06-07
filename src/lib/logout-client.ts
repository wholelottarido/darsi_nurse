import { DARSI_PORTAL_URL } from "@/lib/portal-redirect";

export async function logoutNurseClient() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign(DARSI_PORTAL_URL);
}

export async function logoutAdminLogClient() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign("/login");
}
