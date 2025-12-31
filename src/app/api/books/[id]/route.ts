import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { getBook, deleteBook } from "@/lib/services/books";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("books#show", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) {
    return problem(404, "Book not found");
  }
  return success(book);
});

export const DELETE = withRouteLogging("books#delete", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) {
    return problem(404, "Book not found");
  }
  await deleteBook(book.id);
  return success({ ok: true });
});
