import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { deleteDownloadClient, updateDownloadClient } from "@/lib/services/download-clients";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const PUT = withRouteLogging("downloadClients#update", async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const payload = await request.json();
    const { id } = await params;
    const updated = await updateDownloadClient(Number(id), payload);
    return success(updated);
  } catch (error) {
    return problem(400, "Failed to update download client", error instanceof Error ? error.message : String(error));
  }
});

export const DELETE = withRouteLogging("downloadClients#delete", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  await deleteDownloadClient(Number(id));
  return success({ ok: true });
});
