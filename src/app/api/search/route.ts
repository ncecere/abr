import { NextRequest } from "next/server";
import { success } from "@/lib/http/responses";
import { searchAudiobooks } from "@/lib/services/audible";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("search#audible", async (request: NextRequest) => {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const results = await searchAudiobooks(query);
  return success(results);
});
