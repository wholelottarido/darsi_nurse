export const NURSE_SESSION_COOKIE = "darsi_nurse_session";

export const DARSI_PORTAL_URL =
  process.env.DARSI_PORTAL_URL ?? "https://darsi.ph.hcm-lab.id";

const DEFAULT_NURSE_HOSTS = ["darsi.nrs.hcm-lab.id"];

function getNurseHosts() {
  const fromEnv = process.env.NURSE_APP_HOSTS?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_NURSE_HOSTS, ...(fromEnv ?? [])]);
}

export function getRequestHostname(hostHeader: string | null): string | null {
  if (!hostHeader) {
    return null;
  }

  return hostHeader.split(":")[0]?.toLowerCase() ?? null;
}

export function isNurseProductionHost(hostHeader: string | null): boolean {
  const hostname = getRequestHostname(hostHeader);
  if (!hostname) {
    return false;
  }

  return getNurseHosts().has(hostname);
}

export function getPortalRedirectUrl(hostHeader: string | null): string | null {
  if (!isNurseProductionHost(hostHeader)) {
    return null;
  }

  return DARSI_PORTAL_URL;
}

export function isLandingPath(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

export function isPublicAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}
