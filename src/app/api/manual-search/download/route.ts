import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { books, indexers, releases } from "@/db/schema";
import { problem, success } from "@/lib/http/responses";
import { enqueueJob } from "@/lib/jobs/queue";
import { setBookContext, setDownloadContext, withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

const manualDownloadSchema = z.object({
  bookId: z.number().int().positive(),
  indexerId: z.number().int().positive(),
  guid: z.string().min(1),
  link: z.string().min(1),
  title: z.string().min(1),
  size: z.number().int().optional().nullable(),
});

export const POST = withRouteLogging("manualSearch#download", async (request: NextRequest) => {
  try {
    const payload = manualDownloadSchema.parse(await request.json());

    const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.bookId) });
    if (!book) {
      return problem(404, "Book not found");
    }
    setBookContext({ id: book.id, asin: book.audibleAsin, state: book.state });

    const indexer = await db.query.indexers.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.indexerId) });
    if (!indexer) {
      return problem(404, "Indexer not found");
    }

    const existingRelease = await db.query.releases.findFirst({
      where: (fields, { and, eq }) => and(eq(fields.bookId, book.id), eq(fields.guid, payload.guid)),
    });

    let releaseId = existingRelease?.id;

    if (!releaseId) {
      const [created] = await db
        .insert(releases)
        .values({
          bookId: book.id,
          indexerId: indexer.id,
          guid: payload.guid,
          title: payload.title,
          link: payload.link,
          size: payload.size ?? null,
          score: 0,
        })
        .returning({ id: releases.id });
      releaseId = created.id;
    }

    setDownloadContext({ external_id: payload.guid, status: "queued" });
    await enqueueJob("GRAB_RELEASE", { releaseId });
    return success({ releaseId });
  } catch (error) {
    return problem(400, "Failed to queue download", error instanceof Error ? error.message : String(error));
  }
});
