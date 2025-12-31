import { asc, desc, eq, ne } from "drizzle-orm";
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
import type { DownloadClientPathMapping } from "@/db/schema";
import { Job } from "@/db/schema";

import { emitActivity } from "@/lib/activity";
import { DownloaderType, JobType } from "@/lib/domain";
import { importFileForBook } from "@/lib/importer";
import { createDownloadClient } from "@/lib/downloaders";
import { listDownloadClientPathMappings, applyDownloadClientPathMappings } from "@/lib/services/download-clients";
import { enqueueJob } from "@/lib/jobs/queue";
import { JobPayloadMap } from "@/lib/jobs/types";
import { ensureLibraryRootSync } from "@/lib/runtime/bootstrap";
import { runAutomaticSearch } from "@/lib/services/automatic-search";


export const jobHandlers: Record<JobType, (job: Job) => Promise<void>> = {
  SEARCH_BOOK: (job) => handleSearchBook(job),
  SEARCH_MISSING_BOOKS: () => handleSearchMissingBooks(),
  GRAB_RELEASE: (job) => handleGrabRelease(job),
  POLL_DOWNLOADS: () => handlePollDownloads(),
  IMPORT_DOWNLOAD: (job) => handleImportDownload(job),
};

async function handleSearchBook(job: Job) {
  const payload = parsePayload(job, "SEARCH_BOOK");
  await runAutomaticSearch(payload.bookId);
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
  const rawActive = await db
    .select()
    .from(downloads)
    .where(ne(downloads.status, "completed"))
    .orderBy(desc(downloads.id));

  const deduped: typeof rawActive = [];
  const seen = new Set<string>();
  for (const entry of rawActive) {
    const key = entry.downloaderItemId ?? String(entry.id);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  const pathMappingCache = new Map<number, DownloadClientPathMapping[]>();

  for (const download of deduped.reverse()) {
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

    let resolvedOutputPath = status.outputPath;
    if (status.outputPath) {
      let mappings = pathMappingCache.get(client.id);
      if (mappings === undefined) {
        mappings = await listDownloadClientPathMappings(client.id);
        pathMappingCache.set(client.id, mappings);
      }
      if (mappings.length) {
        resolvedOutputPath = applyDownloadClientPathMappings(status.outputPath, mappings);
      }
    }

    const updateWhere = download.downloaderItemId
      ? eq(downloads.downloaderItemId, download.downloaderItemId)
      : eq(downloads.id, download.id);

    await db
      .update(downloads)
      .set({ status: status.status, outputPath: resolvedOutputPath, error: status.error, updatedAt: new Date() })
      .where(updateWhere);

    if (status.status === "completed" && resolvedOutputPath) {
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

