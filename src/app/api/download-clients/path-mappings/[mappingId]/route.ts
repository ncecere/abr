import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { downloadClientPathMappings } from "@/db/schema";
import { success, problem } from "@/lib/http/responses";
import { deleteDownloadClientPathMapping, updateDownloadClientPathMapping } from "@/lib/services/download-clients";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ mappingId: string }> }) {
  try {
    const { mappingId } = await params;
    const id = Number(mappingId);
    if (!Number.isInteger(id) || id <= 0) {
      return problem(400, "Invalid mapping id");
    }
    const payload = await request.json();
    const updated = await updateDownloadClientPathMapping(id, payload);
    return success(updated);
  } catch (error) {
    return problem(400, "Failed to update path mapping", error instanceof Error ? error.message : String(error));
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ mappingId: string }> }) {
  const { mappingId } = await params;
  const id = Number(mappingId);
  if (!Number.isInteger(id) || id <= 0) {
    return problem(400, "Invalid mapping id");
  }

  const mapping = await db.query.downloadClientPathMappings.findFirst({
    where: (fields, { eq }) => eq(fields.id, id),
  });
  if (!mapping) {
    return problem(404, "Path mapping not found");
  }

  await deleteDownloadClientPathMapping(id);
  return success({ ok: true });
}
