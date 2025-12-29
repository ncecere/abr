import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { createDownloadClient, listDownloadClients } from "@/lib/services/download-clients";

export const runtime = "nodejs";

export async function GET() {
  const data = await listDownloadClients();
  return success(data);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const client = await createDownloadClient(payload);
    return success(client, { status: 201 });
  } catch (error) {
    return problem(400, "Unable to create download client", error instanceof Error ? error.message : String(error));
  }
}
