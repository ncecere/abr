import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { createDownloadClient, listDownloadClients } from "@/lib/services/download-clients";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("downloadClients#index", async (_request: NextRequest) => {
  const data = await listDownloadClients();
  return success(data);
});

export const POST = withRouteLogging("downloadClients#create", async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const client = await createDownloadClient(payload);
    return success(client, { status: 201 });
  } catch (error) {
    return problem(400, "Unable to create download client", error instanceof Error ? error.message : String(error));
  }
});
