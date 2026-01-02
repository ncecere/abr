import { NextRequest } from "next/server";
import { success } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";
import { clearSessionCookie, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = withRouteLogging("auth#logout", async (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
  }
  const response = success({ ok: true });
  clearSessionCookie(response);
  return response;
}, { allowAnonymous: true });
