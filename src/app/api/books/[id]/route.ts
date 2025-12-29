import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { books } from "@/db/schema";
import { success, problem } from "@/lib/http/responses";
import { getBook, deleteBook } from "@/lib/services/books";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const book = await getBook(Number(params.id));
  if (!book) {
    return problem(404, "Book not found");
  }
  return success(book);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const book = await getBook(Number(params.id));
  if (!book) {
    return problem(404, "Book not found");
  }
  await deleteBook(book.id);
  return success({ ok: true });
}
