import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { getSettings } from "@/lib/services/settings";
import { problem } from "@/lib/http/responses";
import { clearSessionCookie, SESSION_COOKIE_NAME, validateSessionToken } from "@/lib/auth/session";

export async function enforceApiAuth(request: NextRequest, allowAnonymous = false) {
  const currentSettings = await getSettings();
  if (!currentSettings?.authEnabled || allowAnonymous) {
    return null;
  }

  const headerKey = extractApiKey(request);
  if (headerKey && currentSettings.apiKey && safeCompare(headerKey, currentSettings.apiKey)) {
    return null;
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (sessionToken && (await validateSessionToken(sessionToken))) {
    return null;
  }

  const response = problem(401, "Authentication required");
  clearSessionCookie(response);
  return response;
}

function extractApiKey(request: NextRequest) {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) {
    return headerKey.trim();
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return undefined;
  const [scheme, value] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }
  return value?.trim();
}

function safeCompare(expected: string, provided: string) {
  if (expected.length !== provided.length) {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return timingSafeEqual(a, b);
}
