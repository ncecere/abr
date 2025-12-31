import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getBook } from "@/lib/services/books";
import { withRouteLogging } from "@/lib/logging/wide-event";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRouteLogging("books#cover", async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book?.coverPath) {
    return new NextResponse(undefined, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(book.coverPath);
    const ext = path.extname(book.coverPath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "image/jpeg";
    return new NextResponse(buffer, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new NextResponse(undefined, { status: 404 });
  }
});
