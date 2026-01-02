import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { authSessions, Settings } from "@/db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const COOKIE_NAME = "abr_session";
export const SESSION_COOKIE_NAME = COOKIE_NAME;

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function createSession(userAgent?: string) {
  await cleanupExpiredSessions();
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authSessions).values({ token, userAgent, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(token: string) {
  await db.delete(authSessions).where(eq(authSessions.token, token));
}

export async function revokeAllSessions() {
  await db.delete(authSessions);
}

export async function validateSessionToken(
  token: string,
  options: { extend?: boolean } = {},
) {
  if (!token) return false;
  const session = await db.query.authSessions.findFirst({ where: (fields, { eq }) => eq(fields.token, token) });
  if (!session) {
    return false;
  }
  const now = new Date();
  if (session.expiresAt <= now) {
    await deleteSession(token);
    return false;
  }
  if (options.extend !== false) {
    const nextExpiry = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(authSessions)
      .set({ expiresAt: nextExpiry })
      .where(eq(authSessions.id, session.id));
  }
  return true;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function requirePageAuth(settings: Settings | null, sessionToken?: string | null) {
  if (!settings?.authEnabled) {
    return;
  }
  if (!sessionToken) {
    redirect("/login");
  }
  const isValid = await validateSessionToken(sessionToken);
  if (!isValid) {
    redirect("/login");
  }
}

async function cleanupExpiredSessions() {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
}
