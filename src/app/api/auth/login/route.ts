import { NextRequest } from "next/server";
import { z } from "zod";
import { success, problem } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";
import { getSettings } from "@/lib/services/settings";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const runtime = "nodejs";

export const POST = withRouteLogging("auth#login", async (request: NextRequest) => {
  try {
    const payload = loginSchema.parse(await request.json());
    const settings = await getSettings();
    if (!settings?.authEnabled) {
      return problem(400, "Authentication is not enabled");
    }

    if (payload.username.trim() !== (settings.authUsername ?? "")) {
      return problem(401, "Invalid credentials");
    }

    const isValidPassword = await verifyPassword(payload.password, settings.authPasswordHash ?? undefined);
    if (!isValidPassword) {
      return problem(401, "Invalid credentials");
    }

    const session = await createSession(request.headers.get("user-agent") ?? undefined);
    const response = success({ ok: true });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const detail = error.issues.map((issue) => issue.message).join(", ");
      return problem(400, "Invalid request", detail);
    }
    return problem(400, "Unable to sign in", error instanceof Error ? error.message : String(error));
  }
}, { allowAnonymous: true });
