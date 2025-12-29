import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  books,
  downloads,
  downloadClients,
  formats,
  indexers,
  releases,
  settings,
} from "@/db/schema";
import { Job } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { DownloaderType, JobType } from "@/lib/domain";
import { importFileForBook } from "@/lib/importer";
import { createDownloadClient } from "@/lib/downloaders";
import { queryNewznab } from "@/lib/services/newznab";
import { MatchResult, scoreRelease } from "@/lib/matching";
import { enqueueJob } from "@/lib/jobs/queue";
import { JobPayloadMap } from "@/lib/jobs/types";
import { ensureLibraryRootSync } from "@/lib/runtime/bootstrap";

const MAX_RELEASES_PER_INDEXER = 25;

export const jobHandlers: Record<JobType, (job: Job) => Promise<void>> = {
  SEARCH_BOOK: (job) => handleSearchBook(job),
  SEARCH_MISSING_BOOKS: () => handleSearchMissingBooks(),
  GRAB_RELEASE: (job) => handleGrabRelease(job),
  POLL_DOWNLOADS: () => handlePollDownloads(),
  IMPORT_DOWNLOAD: (job) => handleImportDownload(job),
};

async function handleSearchBook(job: Job) {
  const payload = parsePayload(job, "SEARCH_BOOK");
  const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.bookId) });
  if (!book || book.state !== "MISSING") {
    return;
  }

  const enabledIndexers = await db.query.indexers.findMany({
    where: (fields, { eq }) => eq(fields.enabled, true),
    orderBy: (fields, { asc }) => asc(fields.priority),
  });

  const enabledFormats = await db.query.formats.findMany({
    where: (fields, { eq }) => eq(fields.enabled, true),
    orderBy: (fields, { asc }) => asc(fields.priority),
  });

  if (!enabledIndexers.length) {
    await emitActivity("ERROR", "No indexers configured", book.id);
    return;
  }

  const candidates: MatchResult[] = [];
  for (const indexer of enabledIndexers) {
    const categories = safeParseNumberArray(indexer.categories);
    const releasesResponse = await queryNewznab(
      { baseUrl: indexer.baseUrl, apiKey: indexer.apiKey, categories },
      book.title,
      MAX_RELEASES_PER_INDEXER,
    );

    releasesResponse.forEach((result) => {
      const normalized = scoreRelease(
        book,
        { ...result, indexerId: indexer.id },
        enabledFormats,
      );
      if (normalized) {
        candidates.push(normalized);
      }
    });
  }

  const bestMatch = candidates.sort((a, b) => b.score - a.score)[0];
  if (!bestMatch) {
    await emitActivity("ERROR", `No release found for ${book.title}`, book.id);
    return;
  }

  const releaseId = await db
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

  await emitActivity("RELEASE_FOUND", bestMatch.release.title, book.id);
  await enqueueJob("GRAB_RELEASE", { releaseId: releaseId[0].id });
}

async function handleSearchMissingBooks() {
  const missing = await db
    .select()
    .from(books)
    .where(eq(books.state, "MISSING"))
    .limit(10);

  await Promise.all(
    missing.map((book, index) =>
      enqueueJob("SEARCH_BOOK", { bookId: book.id }, new Date(Date.now() + index * 1500)),
    ),
  );
}

async function handleGrabRelease(job: Job) {
  const payload = parsePayload(job, "GRAB_RELEASE");
  const release = await db.query.releases.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.releaseId) });
  if (!release) return;

  const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, release.bookId) });
  if (!book) return;

  const currentSettings = await db.query.settings.findFirst();
  if (!currentSettings?.activeDownloaderClientId) {
    await emitActivity("ERROR", "No active download client set", book.id);
    return;
  }
  const activeClientId = currentSettings.activeDownloaderClientId as number;

  const client = await db.query.downloadClients.findFirst({
    where: (fields, { eq }) => eq(fields.id, activeClientId),
  });
  if (!client) {
    await emitActivity("ERROR", "Active download client missing", book.id);
    return;
  }

  const adapter = createDownloadClient({
    type: client.type as DownloaderType,
    host: client.host,
    port: client.port,
    apiKey: client.apiKey ?? undefined,
    username: client.username ?? undefined,
    password: client.password ?? undefined,
    category: client.category,
  });

  const downloadId = await adapter.enqueue(release.link, { title: book.title, bookId: book.id });

  await db.insert(downloads).values({
    bookId: book.id,
    downloadClientId: client.id,
    downloaderItemId: downloadId,
    status: "downloading",
  });

  await emitActivity("DOWNLOAD_STARTED", `Download started (${client.name})`, book.id);
  await enqueueJob("POLL_DOWNLOADS", {});
}

async function handlePollDownloads() {
  const active = await db
    .select()
    .from(downloads)
    .where(and(ne(downloads.status, "completed"), ne(downloads.status, "failed")));

  for (const download of active) {
    const client = await db.query.downloadClients.findFirst({
      where: (fields, { eq }) => eq(fields.id, download.downloadClientId),
    });
    if (!client) continue;

    const adapter = createDownloadClient({
      type: client.type as DownloaderType,
      host: client.host,
      port: client.port,
      apiKey: client.apiKey ?? undefined,
      username: client.username ?? undefined,
      password: client.password ?? undefined,
      category: client.category,
    });

    const status = await adapter.getStatus(download.downloaderItemId);
    if (status.status === download.status && !status.outputPath) {
      continue;
    }

    await db
      .update(downloads)
      .set({ status: status.status, outputPath: status.outputPath, error: status.error, updatedAt: new Date() })
      .where(eq(downloads.id, download.id));

    if (status.status === "completed" && status.outputPath) {
      await emitActivity("DOWNLOAD_COMPLETED", "Download completed", download.bookId);
      await enqueueJob("IMPORT_DOWNLOAD", { downloadId: download.id });
    }

    if (status.status === "failed") {
      await emitActivity("ERROR", status.error ?? "Download failed", download.bookId);
    }
  }
}

async function handleImportDownload(job: Job) {
  const payload = parsePayload(job, "IMPORT_DOWNLOAD");
  const download = await db.query.downloads.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.downloadId) });
  if (!download?.outputPath) return;

  const currentSettings = await db.query.settings.findFirst();
  const libraryRoot = currentSettings?.libraryRoot ?? "var/library";
  await ensureLibraryRootSync(libraryRoot);

  const enabledFormats = await db.query.formats.findMany({
    where: (fields, { eq }) => eq(fields.enabled, true),
    orderBy: (fields, { asc }) => asc(fields.priority),
  });

  await importFileForBook({
    bookId: download.bookId,
    downloadPath: download.outputPath,
    libraryRoot,
    formatExtensions: enabledFormats.map((format) => ({
      name: format.name,
      extensions: JSON.parse(format.extensions ?? "[]"),
      priority: format.priority,
    })),
  });
}

function parsePayload<TType extends JobType>(job: Job, type: TType): JobPayloadMap[TType] {
  return JSON.parse(job.payload) as JobPayloadMap[TType];
}

function safeParseNumberArray(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => Number(value)) : [];
  } catch {
    return [];
  }
}
