import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { deleteDownloadClient, updateDownloadClient } from "@/lib/services/download-clients";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const updated = await updateDownloadClient(Number(params.id), payload);
    return success(updated);
  } catch (error) {
    return problem(400, "Failed to update download client", error instanceof Error ? error.message : String(error));
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await deleteDownloadClient(Number(params.id));
  return success({ ok: true });
}
