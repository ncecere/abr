import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { createFormat, listFormats } from "@/lib/services/formats";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("formats#index", async (_request: NextRequest) => {
  const data = await listFormats();
  return success(data);
});

export const POST = withRouteLogging("formats#create", async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const format = await createFormat(payload);
    return success(format, { status: 201 });
  } catch (error) {
    return problem(400, "Unable to create format", error instanceof Error ? error.message : String(error));
  }
});
