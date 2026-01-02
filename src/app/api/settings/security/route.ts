import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";
import { updateSecuritySettings } from "@/lib/services/settings";
import { securitySettingsSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export const PUT = withRouteLogging("settings#security", async (request: NextRequest) => {
  try {
    const payload = securitySettingsSchema.parse(await request.json());
    const result = await updateSecuritySettings(payload);
    return success({
      authEnabled: result.settings.authEnabled,
      username: result.settings.authUsername,
      apiKey: result.settings.apiKey,
      requireReauth: result.requireReauth,
    });
  } catch (error) {
    return problem(400, "Failed to update security settings", error instanceof Error ? error.message : String(error));
  }
});
