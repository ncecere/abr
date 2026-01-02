import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";
import { rotateApiKey } from "@/lib/services/settings";

export const runtime = "nodejs";

export const POST = withRouteLogging("settings#rotateApiKey", async (_request: NextRequest) => {
  try {
    const updated = await rotateApiKey();
    return success({ apiKey: updated.apiKey });
  } catch (error) {
    return problem(400, "Failed to rotate API key", error instanceof Error ? error.message : String(error));
  }
});
