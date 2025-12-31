import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { addBook, listBooks } from "@/lib/services/books";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("books#index", async (request: NextRequest) => {
  const state = request.nextUrl.searchParams.get("state") ?? undefined;
  const query = request.nextUrl.searchParams.get("q") ?? undefined;
  const data = await listBooks({ state: state ?? undefined, search: query ?? undefined });
  return success(data);
});

export const POST = withRouteLogging("books#create", async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const book = await addBook(payload);
    return success(book, { status: 201 });
  } catch (error) {
    return problem(400, "Failed to add book", error instanceof Error ? error.message : String(error));
  }
});
