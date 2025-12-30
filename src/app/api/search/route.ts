import { success } from "@/lib/http/responses";
import { searchAudiobooks } from "@/lib/services/audible";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const results = await searchAudiobooks(query);
  return success(results);
}
