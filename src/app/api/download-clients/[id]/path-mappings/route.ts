import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { downloadClients } from "@/db/schema";
import { success, problem } from "@/lib/http/responses";
import {
  createDownloadClientPathMapping,
  listDownloadClientPathMappings,
} from "@/lib/services/download-clients";
import { downloadClientPathMappingSchema } from "@/lib/validation/schemas";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("downloadClients#pathMappings", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return problem(400, "Invalid download client id");
  }

  const client = await db.query.downloadClients.findFirst({ where: (fields, { eq }) => eq(fields.id, clientId) });
  if (!client) {
    return problem(404, "Download client not found");
  }

  const mappings = await listDownloadClientPathMappings(clientId);
  return success(mappings);
});

export const POST = withRouteLogging("downloadClients#createPathMapping", async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return problem(400, "Invalid download client id");
    }

    const client = await db.query.downloadClients.findFirst({ where: (fields, { eq }) => eq(fields.id, clientId) });
    if (!client) {
      return problem(404, "Download client not found");
    }

    const payload = downloadClientPathMappingSchema.parse(await request.json());
    const mapping = await createDownloadClientPathMapping(clientId, payload);
    return success(mapping, { status: 201 });
  } catch (error) {
    return problem(400, "Unable to create path mapping", error instanceof Error ? error.message : String(error));
  }
});

