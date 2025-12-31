import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { runAutomaticSearch } from "@/lib/services/automatic-search";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const POST = withRouteLogging("books#manualSearch", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return problem(400, "Invalid book id");
  }

  const result = await runAutomaticSearch(bookId);
  if (!result.ok) {
    return problem(result.status ?? 400, result.message);
  }

  return success({ releaseId: result.releaseId, releaseTitle: result.releaseTitle });
});

