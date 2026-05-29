import { NextResponse } from "next/server";

import { NURSE_SESSION_COOKIE } from "@/lib/nurse-auth";

export async function POST() {
  const response = NextResponse.json({ message: "Logout berhasil." });

  response.cookies.delete(NURSE_SESSION_COOKIE);

  return response;
}
