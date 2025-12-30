import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { books } from "@/db/schema";
import { getBook } from "@/lib/services/books";
import { ensureLibraryRootSync, DEFAULT_LIBRARY_ROOT } from "@/lib/runtime/bootstrap";
import { getBookDirectory } from "@/lib/library/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { title: book.title, authors: JSON.parse(book.authorsJson ?? "[]") } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? book.title).trim();
  const authorsInput = String(formData.get("authors") ?? "").trim();
  const authors = authorsInput
    ? authorsInput.split(",").map((value) => value.trim()).filter(Boolean)
    : JSON.parse(book.authorsJson ?? "[]");
  const file = formData.get("cover") as File | null;

  let coverPath = book.coverPath;
  if (file && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
    const settingsRoot = DEFAULT_LIBRARY_ROOT;
    await ensureLibraryRootSync(settingsRoot);
    const directory = getBookDirectory(authors.length ? authors : ["unknown-author"], title, settingsRoot);
    await fs.mkdir(directory, { recursive: true });
    const extension = path.extname(file.name) || ".jpg";
    const target = path.join(directory, `cover${extension}`);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(target, Buffer.from(arrayBuffer));
    coverPath = target;
  }

  await db
    .update(books)
    .set({ title, authorsJson: JSON.stringify(authors), coverPath })
    .where(eq(books.id, book.id));

  return NextResponse.json({ data: { title, authors } });
}
