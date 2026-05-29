import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { hospitalQuery } from "@/lib/hospital-db";

export const runtime = "nodejs";

const defaultRegisterStatus = "Inactive";

type RegisterBody = {
  username?: unknown;
  password?: unknown;
  namaLengkap?: unknown;
  telepon?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;

    const username = readText(body.username).toLowerCase();
    const password = readText(body.password);
    const namaLengkap = readText(body.namaLengkap);
    const telepon = readText(body.telepon);

    if (!username || !password || !namaLengkap) {
      return NextResponse.json(
        { error: "Username, password, dan nama lengkap wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    const existing = await hospitalQuery(
      "SELECT id FROM perawat WHERE username = $1 LIMIT 1",
      [username]
    );

    if (existing.rowCount) {
      return NextResponse.json(
        { error: "Username sudah terdaftar." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await hospitalQuery(
      `INSERT INTO perawat (username, password_hash, nama_lengkap, telepon, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, nama_lengkap, telepon, status, created_at`,
      [username, passwordHash, namaLengkap, telepon || null, defaultRegisterStatus]
    );

    return NextResponse.json(
      {
        message: "Registrasi perawat berhasil disimpan.",
        perawat: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register perawat error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "Username sudah terdaftar." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Registrasi gagal disimpan ke database." },
      { status: 500 }
    );
  }
}
