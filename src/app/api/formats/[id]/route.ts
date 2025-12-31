import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { deleteFormat, updateFormat } from "@/lib/services/formats";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const PUT = withRouteLogging("formats#update", async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const payload = await request.json();
    const { id } = await params;
    const updated = await updateFormat(Number(id), payload);
    return success(updated);
  } catch (error) {
    return problem(400, "Failed to update format", error instanceof Error ? error.message : String(error));
  }
});

export const DELETE = withRouteLogging("formats#delete", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  await deleteFormat(Number(id));
  return success({ ok: true });
});
