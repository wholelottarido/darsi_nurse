import { NextResponse } from "next/server";

import { ADMIN_LOG_SESSION_COOKIE } from "@/lib/auth/admin-log-auth";
import { NURSE_SESSION_COOKIE } from "@/lib/auth/nurse-auth";

export async function POST() {
  const response = NextResponse.json({ message: "Logout berhasil." });

  response.cookies.delete(ADMIN_LOG_SESSION_COOKIE);
  response.cookies.delete(NURSE_SESSION_COOKIE);

  return response;
}
