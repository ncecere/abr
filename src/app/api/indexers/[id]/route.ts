import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { deleteIndexer, updateIndexer } from "@/lib/services/indexers";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const PUT = withRouteLogging("indexers#update", async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const payload = await request.json();
    const { id } = await params;
    const updated = await updateIndexer(Number(id), payload);
    return success(updated);
  } catch (error) {
    return problem(400, "Failed to update indexer", error instanceof Error ? error.message : String(error));
  }
});

export const DELETE = withRouteLogging("indexers#delete", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  await deleteIndexer(Number(id));
  return success({ ok: true });
});
