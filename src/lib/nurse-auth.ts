import crypto from "crypto";
import { cookies } from "next/headers";

import { hospitalQuery } from "./hospital-db";

export const NURSE_SESSION_COOKIE = "darsi_nurse_session";
export const NURSE_SESSION_MAX_AGE = 60 * 60 * 12;

export type PerawatSession = {
  id: string;
  username: string;
  namaLengkap: string;
  status: string;
};

type SessionPayload = {
  perawatId: string;
  username: string;
  exp: number;
};

const activeStatuses = new Set(["On Duty", "Off Duty"]);

export function canPerawatLogin(status: string) {
  return activeStatuses.has(status);
}

export function createNurseSessionToken(perawatId: string, username: string) {
  const payload: SessionPayload = {
    perawatId,
    username,
    exp: Math.floor(Date.now() / 1000) + NURSE_SESSION_MAX_AGE,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function getCurrentPerawat(): Promise<PerawatSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NURSE_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyNurseSessionToken(token);
  if (!payload) {
    return null;
  }

  const result = await hospitalQuery(
    `SELECT id, username, nama_lengkap, status
     FROM perawat
     WHERE id = $1 AND username = $2
     LIMIT 1`,
    [payload.perawatId, payload.username]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const perawat = result.rows[0];
  if (!canPerawatLogin(perawat.status)) {
    return null;
  }

  return {
    id: perawat.id,
    username: perawat.username,
    namaLengkap: perawat.nama_lengkap,
    status: perawat.status,
  };
}

function verifyNurseSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  if (!isValidSignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (
      !payload.perawatId ||
      !payload.username ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function isValidSignature(encodedPayload: string, signature: string) {
  const expectedSignature = sign(encodedPayload);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function getSessionSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.HOSPITAL_CS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "darsi-nurse-dev-secret"
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
