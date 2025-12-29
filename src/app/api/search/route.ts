import { success } from "@/lib/http/responses";
import { searchBooks } from "@/lib/services/openlibrary";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const results = await searchBooks(query);
  return success(results);
}
