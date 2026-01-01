import { db } from "@/db/client";
import { books, indexers, formats, releases, downloads } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs/queue";
import { findBestReleaseMatch, MAX_RELEASES_PER_INDEXER } from "@/lib/services/release-search";

export type AutomaticSearchResult =
  | { ok: true; releaseId: number; releaseTitle: string }
  | { ok: false; status?: number; message: string };

export async function runAutomaticSearch(bookId: number): Promise<AutomaticSearchResult> {
  const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, bookId) });
  if (!book) {
    return { ok: false, status: 404, message: "Book not found" };
  }
  if (book.state !== "MISSING") {
    return { ok: false, status: 400, message: "Book already available" };
  }

  const enabledIndexers = await db.query.indexers.findMany({
    where: (fields, { eq }) => eq(fields.enabled, true),
    orderBy: (fields, { asc }) => asc(fields.priority),
  });
  if (!enabledIndexers.length) {
    await emitActivity("ERROR", "No indexers configured", book.id);
    return { ok: false, status: 400, message: "No indexers configured" };
  }

  const enabledFormats = await db.query.formats.findMany({
    where: (fields, { eq }) => eq(fields.enabled, true),
    orderBy: (fields, { asc }) => asc(fields.priority),
  });

  const activeDownload = await db.query.downloads.findFirst({
    where: (fields, { and, eq: eqOp, ne }) => and(eqOp(fields.bookId, book.id), ne(fields.status, "failed")),
  });
  if (activeDownload) {
    await emitActivity("ERROR", `Download already in progress for ${book.title}`, book.id);
    return { ok: false, status: 409, message: "Download already in progress" };
  }

  const { bestMatch, failures } = await findBestReleaseMatch(
    book,
    enabledIndexers,
    enabledFormats,
    MAX_RELEASES_PER_INDEXER,
  );
  if (!bestMatch) {
    if (failures.length === enabledIndexers.length && failures.length > 0) {
      await emitActivity(
        "ERROR",
        `All indexers failed during search (${failures.map((failure) => failure.name).join(", ")})`,
        book.id,
      );
    } else {
      await emitActivity("ERROR", `No release found for ${book.title}`, book.id);
    }
    return { ok: false, status: 404, message: `No release found for ${book.title}` };
  }

  const existingRelease = await db.query.releases.findFirst({
    where: (fields, { and, eq: eqOp }) => and(eqOp(fields.bookId, book.id), eqOp(fields.guid, bestMatch.release.guid)),
  });
  if (existingRelease) {
    await emitActivity("ERROR", `Release already queued for ${book.title}`, book.id);
    return { ok: false, status: 409, message: "Release already queued" };
  }

  const [releaseRow] = await db
    .insert(releases)
    .values({
      bookId: book.id,
      indexerId: bestMatch.release.indexerId,
      guid: bestMatch.release.guid,
      title: bestMatch.release.title,
      link: bestMatch.release.link,
      size: bestMatch.release.size,
      score: bestMatch.score * 100,
    })
    .returning({ id: releases.id });

  if (failures.length) {
    await emitActivity(
      "ERROR",
      `Some indexers failed during search: ${failures.map((failure) => failure.name).join(", ")}`,
      book.id,
    );
  }

  await emitActivity("RELEASE_FOUND", bestMatch.release.title, book.id);
  await enqueueJob("GRAB_RELEASE", { releaseId: releaseRow.id });
  return { ok: true, releaseId: releaseRow.id, releaseTitle: bestMatch.release.title };
}
