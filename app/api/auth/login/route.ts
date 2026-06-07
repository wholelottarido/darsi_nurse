import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  ADMIN_LOG_SESSION_COOKIE,
  ADMIN_LOG_SESSION_MAX_AGE,
  createAdminLogSessionToken,
  isAdminLogCredential,
} from "@/lib/auth/admin-log-auth";
import { hospitalQuery } from "@/lib/db/hospital-db";
import {
  canPerawatLogin,
  createNurseSessionToken,
  NURSE_SESSION_COOKIE,
  NURSE_SESSION_MAX_AGE,
} from "@/lib/auth/nurse-auth";

export const runtime = "nodejs";

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const username = readText(body.username).toLowerCase();
    const password = readText(body.password);

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (isAdminLogCredential(username, password)) {
      const adminToken = createAdminLogSessionToken(username);
      const response = NextResponse.json({
        message: "Login admin log berhasil.",
        role: "log_admin",
        redirectTo: "/log-admin",
      });

      response.cookies.set({
        name: ADMIN_LOG_SESSION_COOKIE,
        value: adminToken,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ADMIN_LOG_SESSION_MAX_AGE,
      });

      response.cookies.delete(NURSE_SESSION_COOKIE);

      return response;
    }

    const result = await hospitalQuery(
      `SELECT id, username, password_hash, nama_lengkap, status
       FROM perawat
       WHERE username = $1
       LIMIT 1`,
      [username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const perawat = result.rows[0];
    const passwordValid = await bcrypt.compare(password, perawat.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    if (!canPerawatLogin(perawat.status)) {
      return NextResponse.json(
        { error: "Akun belum diaktifkan oleh administrator." },
        { status: 403 }
      );
    }

    const token = createNurseSessionToken(perawat.id, perawat.username);
    const response = NextResponse.json({
      message: "Login berhasil.",
      role: "perawat",
      redirectTo: "/dashboard",
      perawat: {
        id: perawat.id,
        username: perawat.username,
        namaLengkap: perawat.nama_lengkap,
        status: perawat.status,
      },
    });

    response.cookies.set({
      name: NURSE_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: NURSE_SESSION_MAX_AGE,
    });

    response.cookies.delete(ADMIN_LOG_SESSION_COOKIE);

    return response;
  } catch (error) {
    console.error("Login perawat error:", error);
    return NextResponse.json(
      { error: "Login gagal. Coba lagi." },
      { status: 500 }
    );
  }
}
