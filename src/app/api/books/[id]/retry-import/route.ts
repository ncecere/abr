import { NextRequest } from "next/server";
import { desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { books, downloads } from "@/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";
import { problem, success } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRouteLogging("books#retryImport", async (
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return problem(400, "Invalid book id");
  }

  const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, bookId) });
  if (!book) {
    return problem(404, "Book not found");
  }

  const download = await db.query.downloads.findFirst({
    where: (fields, { eq, isNotNull }) => eq(fields.bookId, bookId) && isNotNull(fields.outputPath),
    orderBy: (fields, { desc }) => desc(fields.id),
  });

  if (!download) {
    return problem(404, "No finished downloads to import yet");
  }

  await db.update(downloads).set({ status: "completed" }).where(eq(downloads.id, download.id));
  await enqueueJob("IMPORT_DOWNLOAD", { downloadId: download.id });

  return success({ downloadId: download.id });
});

