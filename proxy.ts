import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DARSI_PORTAL_URL,
  NURSE_SESSION_COOKIE,
  isLandingPath,
  isNurseProductionHost,
  isPublicAuthPath,
} from "./src/lib/portal-redirect";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host");

  if (!isNurseProductionHost(host)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(NURSE_SESSION_COOKIE)?.value;
  if (session) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isLandingPath(pathname)) {
    return NextResponse.redirect(DARSI_PORTAL_URL);
  }

  if (isPublicAuthPath(pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
