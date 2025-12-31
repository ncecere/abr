import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { settingsUpdateSchema } from "@/lib/validation/schemas";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("settings#index", async (_request: NextRequest) => {
  const data = await getSettings();
  return success(data);
});

export const PUT = withRouteLogging("settings#update", async (request: NextRequest) => {
  try {
    const payload = settingsUpdateSchema.parse(await request.json());
    const updated = await updateSettings(payload);
    return success(updated);
  } catch (error) {
    return problem(400, "Failed to update settings", error instanceof Error ? error.message : String(error));
  }
});
