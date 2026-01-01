import { asc, desc, eq, ne } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import slugify from "@sindresorhus/slugify";
import { env } from "@/config";
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
import type { DownloadClientPathMapping, Download } from "@/db/schema";
import { Job } from "@/db/schema";

import { emitActivity } from "@/lib/activity";
import { DownloaderType, JobType } from "@/lib/domain";
import { importFileForBook, MultiFileImportError } from "@/lib/importer";
import { createDownloadClient } from "@/lib/downloaders";
import { listDownloadClientPathMappings, applyDownloadClientPathMappings } from "@/lib/services/download-clients";
import { enqueueJob } from "@/lib/jobs/queue";
import { JobPayloadMap } from "@/lib/jobs/types";
import { ensureLibraryRootSync } from "@/lib/runtime/bootstrap";
import { runAutomaticSearch } from "@/lib/services/automatic-search";
import { logger } from "@/lib/logger";
import { mergeTracksWithFfmpeg } from "@/lib/media/merge";

const MULTI_TRACK_EXTENSIONS = new Set([
  "mp4",
  "m4a",
  "m4b",
  "mp3",
  "aac",
  "flac",
  "ogg",
  "opus",
  "wav",
  "mkv",
  "webm",
]);

const MULTI_TRACK_SAMPLE_LIMIT = 5;

export const jobHandlers: Record<JobType, (job: Job) => Promise<void>> = {
  SEARCH_BOOK: (job) => handleSearchBook(job),
  SEARCH_MISSING_BOOKS: () => handleSearchMissingBooks(),
  GRAB_RELEASE: (job) => handleGrabRelease(job),
  POLL_DOWNLOADS: () => handlePollDownloads(),
  IMPORT_DOWNLOAD: (job) => handleImportDownload(job),
  WATCH_DOWNLOAD: (job) => handleWatchDownload(job),
  MERGE_TRACKS: (job) => handleMergeTracks(job),
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

  const [download] = await db
    .insert(downloads)
    .values({
      bookId: book.id,
      downloadClientId: client.id,
      downloaderItemId: downloadId,
      status: "downloading",
    })
    .returning({ id: downloads.id });

  await emitActivity("DOWNLOAD_STARTED", `Download started (${client.name})`, book.id);
  await enqueueJob("WATCH_DOWNLOAD", { downloadId: download.id }, new Date(Date.now() + 15_000));
}

async function handlePollDownloads() {
  logger.info("polling download client statuses");

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
    logger.info({ downloadId: download.id, status: download.status }, "checking download status");
    await updateDownloadStatus(download, pathMappingCache);
  }

  logger.info({ processed: deduped.length }, "poll downloads cycle complete");
}

async function handleWatchDownload(job: Job) {
  const payload = parsePayload(job, "WATCH_DOWNLOAD");
  const download = await db.query.downloads.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.downloadId) });
  if (!download) {
    return;
  }
  if (download.status === "completed" || download.status === "failed") {
    return;
  }

  logger.info({ downloadId: download.id }, "watch job polling download");
  const result = await updateDownloadStatus(download, new Map());
  if (result === "pending") {
    await enqueueJob("WATCH_DOWNLOAD", { downloadId: download.id }, new Date(Date.now() + 15_000));
  }
}

async function updateDownloadStatus(
  download: Download,
  pathMappingCache: Map<number, DownloadClientPathMapping[]>,
): Promise<"pending" | "completed" | "failed"> {
  const client = await db.query.downloadClients.findFirst({
    where: (fields, { eq }) => eq(fields.id, download.downloadClientId),
  });
  if (!client) {
    return "failed";
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

  const status = await adapter.getStatus(download.downloaderItemId);
  if (status.status === download.status && !status.outputPath) {
    const fallbackPath = await findLocalDownloadPath(download.bookId);
    if (fallbackPath) {
      status.status = "completed";
      status.outputPath = fallbackPath;
    } else {
      return "pending";
    }
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
    logger.info({ downloadId: download.id }, "download completed; queued import job");
    await emitActivity("DOWNLOAD_COMPLETED", "Download completed", download.bookId);
    await enqueueJob("IMPORT_DOWNLOAD", { downloadId: download.id });
    return "completed";
  }

  if (status.status === "failed") {
    logger.warn({ downloadId: download.id, error: status.error }, "download failed");
    await emitActivity("ERROR", status.error ?? "Download failed", download.bookId);
    return "failed";
  }

  return "pending";
}

async function findLocalDownloadPath(bookId: number) {
  const base = path.resolve(env.DOWNLOADS_DIR, "downloads", "complete");
  const segments = await fs.readdir(base);
  const prefix = `${bookId}-`.toLowerCase();
  for (const entry of segments) {
    if (entry.toLowerCase().startsWith(prefix)) {
      return path.join(base, entry);
    }
  }
  return undefined;
}

async function handleImportDownload(job: Job) {
  const payload = parsePayload(job, "IMPORT_DOWNLOAD");
  const download = await db.query.downloads.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.downloadId) });
  if (!download?.outputPath) return;

  const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, download.bookId) });
  if (!book) return;

  const currentSettings = await db.query.settings.findFirst();
  const libraryRoot = currentSettings?.libraryRoot ?? "var/library";
  await ensureLibraryRootSync(libraryRoot);

  const enabledFormats = await db.query.formats.findMany({
    where: (fields, { eq }) => eq(fields.enabled, true),
    orderBy: (fields, { asc }) => asc(fields.priority),
  });

  const importPath = await resolveImportSourcePath(download.outputPath);

  const preflightMultiTrack = await detectMultiTrackInDirectory(importPath);
  if (!preflightMultiTrack) {
    logger.info({ downloadId: download.id, importPath }, "pre-import track scan: no tracks detected");
  } else {
    logger.info({
      downloadId: download.id,
      importPath,
      trackCount: preflightMultiTrack.files.length,
      sample: preflightMultiTrack.files.slice(0, MULTI_TRACK_SAMPLE_LIMIT),
      extension: preflightMultiTrack.extension,
    }, "pre-import track scan");
  }

  if (preflightMultiTrack && preflightMultiTrack.files.length > 1) {
    const mergeExtension =
      preflightMultiTrack.extension ??
      path.extname(preflightMultiTrack.files[0] ?? "")?.replace(/^\./, "").toLowerCase() ??
      "m4b";
    await scheduleMergeTracks(
      download,
      new MultiFileImportError(
        book.id,
        book.title,
        `${mergeExtension.toUpperCase()} tracks`,
        preflightMultiTrack.files,
        mergeExtension,
      ),
    );
    return;
  }

  try {
    await importFileForBook({
      bookId: download.bookId,
      downloadPath: importPath,
      libraryRoot,
      formatExtensions: enabledFormats.map((format) => ({
        name: format.name,
        extensions: JSON.parse(format.extensions ?? "[]"),
        priority: format.priority,
      })),
    });
  } catch (error) {
    if (error instanceof MultiFileImportError) {
      await scheduleMergeTracks(download, error);
      return;
    }
    throw error;
  }

  if (download.downloaderItemId) {
    const client = await db.query.downloadClients.findFirst({
      where: (fields, { eq }) => eq(fields.id, download.downloadClientId),
    });
    if (client) {
      const adapter = createDownloadClient({
        type: client.type as DownloaderType,
        host: client.host,
        port: client.port,
        apiKey: client.apiKey ?? undefined,
        username: client.username ?? undefined,
        password: client.password ?? undefined,
        category: client.category,
      });
      if (typeof adapter.cleanup === "function") {
        try {
          await adapter.cleanup(download.downloaderItemId, { deleteFiles: true });
        } catch (error) {
          logger.warn({ error, downloaderItemId: download.downloaderItemId }, "failed to cleanup download client history");
        }
      }
    }
  }
}

async function handleMergeTracks(job: Job) {
  const payload = parsePayload(job, "MERGE_TRACKS");
  const download = await db.query.downloads.findFirst({ where: (fields, { eq }) => eq(fields.id, payload.downloadId) });
  if (!download?.outputPath) {
    logger.error({ downloadId: payload.downloadId }, "merge job missing download output path");
    return;
  }

  const outputDir = path.dirname(payload.files[0]);
  const baseName = slugify(payload.bookTitle, { separator: "-" }) || `book-${payload.bookId}`;
  let outputPath = path.join(outputDir, `${baseName}.${payload.extension}`);
  let counter = 1;
  while (await pathExists(outputPath)) {
    outputPath = path.join(outputDir, `${baseName}-${counter}.${payload.extension}`);
    counter += 1;
  }

  try {
    await mergeTracksWithFfmpeg(payload.files, outputPath);
  } catch (error) {
    logger.error({ downloadId: download.id, error }, "failed to merge tracks");
    await emitActivity("ERROR", `Failed to merge tracks: ${(error as Error).message}`, payload.bookId);
    await db
      .update(downloads)
      .set({ status: "failed", error: "Track merge failed", updatedAt: new Date() })
      .where(eq(downloads.id, download.id));
    await enqueueJob("SEARCH_BOOK", { bookId: payload.bookId }, new Date(Date.now() + 60_000));
    return;
  }

  await Promise.all(
    payload.files
      .filter((file) => file !== outputPath)
      .map((file) => fs.unlink(file).catch(() => {})),
  );

  await db
    .update(downloads)
    .set({ outputPath, status: "downloading", error: null, updatedAt: new Date() })
    .where(eq(downloads.id, download.id));

  logger.info({ downloadId: download.id, mergedPath: outputPath }, "merged multi-track release");
  await emitActivity(
    "DOWNLOAD_COMPLETED",
    `Merged ${payload.files.length} tracks into a single ${payload.format} file`,
    payload.bookId,
  );

  await enqueueJob("IMPORT_DOWNLOAD", { downloadId: download.id }, new Date(Date.now() + 5_000));
}

async function scheduleMergeTracks(download: Download, error: MultiFileImportError) {
  await db
    .update(downloads)
    .set({ status: "downloading", error: "Merging multi-track release", updatedAt: new Date() })
    .where(eq(downloads.id, download.id));

  await emitActivity(
    "ERROR",
    `Detected ${error.files.length} files for ${error.formatName}; merging tracks into a single container`,
    download.bookId,
  );

  await enqueueJob("MERGE_TRACKS", {
    downloadId: download.id,
    bookId: error.bookId,
    bookTitle: error.bookTitle,
    format: error.formatName,
    files: error.files,
    extension: error.extension,
  });
}

function parsePayload<TType extends JobType>(job: Job, type: TType): JobPayloadMap[TType] {
  return JSON.parse(job.payload) as JobPayloadMap[TType];
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function resolveImportSourcePath(outputPath: string) {
  try {
    const stats = await fs.stat(outputPath);
    if (stats.isDirectory()) {
      return outputPath;
    }
    return path.dirname(outputPath);
  } catch {
    return path.dirname(outputPath);
  }
}

type TrackScanResult = {
  files: string[];
  extension?: string;
};

async function detectMultiTrackInDirectory(targetPath: string): Promise<TrackScanResult | null> {
  try {
    const files = await collectTrackFiles(targetPath);
    if (!files.length) {
      return null;
    }
    const sorted = files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
    const extensionCounts = new Map<string, number>();
    for (const file of sorted) {
      if (!file.extension) continue;
      extensionCounts.set(file.extension, (extensionCounts.get(file.extension) ?? 0) + 1);
    }
    const dominant = [...extensionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { files: sorted.map((file) => file.path), extension: dominant };
  } catch (error) {
    logger.warn({ targetPath, error }, "failed to scan directory for multi-track files");
    return null;
  }
}

async function collectTrackFiles(targetPath: string): Promise<{ path: string; extension?: string }[]> {
  const stats = await fs.stat(targetPath);
  if (stats.isFile()) {
    const extension = path.extname(targetPath)?.replace(/^\./, "").toLowerCase();
    if (extension && MULTI_TRACK_EXTENSIONS.has(extension)) {
      return [{ path: targetPath, extension }];
    }
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files: { path: string; extension?: string }[] = [];
  for (const entry of entries) {
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTrackFiles(full)));
    } else {
      const extension = path.extname(entry.name)?.replace(/^\./, "").toLowerCase();
      if (extension && MULTI_TRACK_EXTENSIONS.has(extension)) {
        files.push({ path: full, extension });
      }
    }
  }
  return files;
}
