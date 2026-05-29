import { NextResponse } from "next/server";

import { getCurrentPerawat } from "@/lib/nurse-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const perawat = await getCurrentPerawat();

  if (!perawat) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ perawat });
}
