import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { books, indexers } from "@/db/schema";
import { success, problem } from "@/lib/http/responses";
import { fetchReleasesAcrossIndexers } from "@/lib/services/release-search";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const bookId = Number(payload?.bookId);
    if (!bookId) {
      return problem(400, "bookId required");
    }

    const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, bookId) });
    if (!book) {
      return problem(404, "Book not found");
    }

    const enabledIndexers = await db.query.indexers.findMany({
      where: (fields, { eq }) => eq(fields.enabled, true),
      orderBy: (fields, { asc }) => asc(fields.priority),
    });

    if (!enabledIndexers.length) {
      return problem(400, "No enabled indexers", "Add an indexer before running manual search");
    }

    const aggregated = await fetchReleasesAcrossIndexers(book, enabledIndexers, 10);

    const results = aggregated.map(({ indexer, release }) => ({
      id: `${indexer.id}-${release.guid}`,
      title: release.title,
      indexerName: indexer.name,
      indexerId: indexer.id,
      guid: release.guid,
      link: release.link,
      size: release.size,
    }));

    return success(results);
  } catch (error) {
    return problem(400, "Manual search failed", error instanceof Error ? error.message : String(error));
  }
}
