import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { createIndexer, listIndexers } from "@/lib/services/indexers";

export const runtime = "nodejs";

export async function GET() {
  const data = await listIndexers();
  return success(data);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const indexer = await createIndexer(payload);
    return success(indexer, { status: 201 });
  } catch (error) {
    return problem(400, "Unable to create indexer", error instanceof Error ? error.message : String(error));
  }
}
