import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { books, indexers } from "@/db/schema";
import { success, problem } from "@/lib/http/responses";
import { fetchReleasesAcrossIndexers } from "@/lib/services/release-search";
import { setBookContext, setDependencySummary, withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const POST = withRouteLogging("manualSearch#query", async (request: NextRequest) => {
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
    setBookContext({ id: book.id, asin: book.audibleAsin, state: book.state });

    const enabledIndexers = await db.query.indexers.findMany({
      where: (fields, { eq }) => eq(fields.enabled, true),
      orderBy: (fields, { asc }) => asc(fields.priority),
    });

    if (!enabledIndexers.length) {
      return problem(400, "No enabled indexers", "Add an indexer before running manual search");
    }

    setDependencySummary({ indexer_count: enabledIndexers.length });

    const { releases, failures } = await fetchReleasesAcrossIndexers(book, enabledIndexers, 10);

    const results = releases.map(({ indexer, release }) => ({
      id: `${indexer.id}-${release.guid}`,
      title: release.title,
      indexerName: indexer.name,
      indexerId: indexer.id,
      guid: release.guid,
      link: release.link,
      size: release.size,
    }));

    if (failures.length === enabledIndexers.length && failures.length) {
      return problem(502, "All indexers failed", failures.map((failure) => failure.name).join(", "));
    }

    return success(results);
  } catch (error) {
    return problem(400, "Manual search failed", error instanceof Error ? error.message : String(error));
  }
});
