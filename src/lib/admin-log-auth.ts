import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_LOG_SESSION_COOKIE = "darsi_log_admin_session";
export const ADMIN_LOG_SESSION_MAX_AGE = 60 * 60 * 12;

export type AdminLogSession = {
  username: string;
  role: "log_admin";
};

type AdminLogSessionPayload = {
  username: string;
  role: "log_admin";
  exp: number;
};

function readEnvText(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function getAdminLogCredentials() {
  return {
    username: readEnvText(process.env.LOG_ADMIN_USERNAME),
    password: readEnvText(process.env.LOG_ADMIN_PASSWORD),
  };
}

export function isAdminLogCredential(username: string, password: string) {
  const credentials = getAdminLogCredentials();
  if (!credentials.username || !credentials.password) {
    return false;
  }

  return (
    username.trim().toLowerCase() === credentials.username.toLowerCase() &&
    password.trim() === credentials.password
  );
}

export function createAdminLogSessionToken(username: string) {
  const payload: AdminLogSessionPayload = {
    username,
    role: "log_admin",
    exp: Math.floor(Date.now() / 1000) + ADMIN_LOG_SESSION_MAX_AGE,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function getCurrentLogAdmin(): Promise<AdminLogSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_LOG_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyAdminLogSessionToken(token);
  if (!payload) {
    return null;
  }

  const credentials = getAdminLogCredentials();
  if (!credentials.username) {
    return null;
  }

  if (payload.username.toLowerCase() !== credentials.username.toLowerCase()) {
    return null;
  }

  return {
    username: payload.username,
    role: "log_admin",
  };
}

export async function clearAdminLogSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_LOG_SESSION_COOKIE);
}

function verifyAdminLogSessionToken(token: string): AdminLogSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  if (!isValidSignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminLogSessionPayload;
    if (
      !payload.username ||
      payload.role !== "log_admin" ||
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
    "darsi-log-admin-dev-secret"
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
