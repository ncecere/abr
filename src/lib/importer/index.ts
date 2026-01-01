import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { eq } from "drizzle-orm";

const FALLBACK_TRACK_EXTENSIONS = new Set([
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

import { db } from "@/db/client";
import { bookFiles, books } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { logger } from "@/lib/logger";
import { getBookDirectory } from "@/lib/library/paths";

export class MultiFileImportError extends Error {
  constructor(
    public readonly bookId: number,
    public readonly bookTitle: string,
    public readonly formatName: string,
    public readonly files: string[],
    public readonly extension: string,
  ) {
    super(`Multiple files detected for format ${formatName}`);
  }
}

export async function importFileForBook(
  options: {
    bookId: number;
    downloadPath: string;
    libraryRoot: string;
    formatExtensions: { name: string; extensions: string[]; priority: number }[];
  },
) {
  const book = await db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, options.bookId) });
  if (!book) {
    throw new Error(`Book ${options.bookId} not found`);
  }

  const files = await collectFiles(options.downloadPath);
  logger.info({
    downloadPath: options.downloadPath,
    fileCount: files.length,
    sample: files.slice(0, 5),
  }, "importer collected files");
  const normalizedFormats = options.formatExtensions.sort((a, b) => a.priority - b.priority);

  for (const format of normalizedFormats) {
    const matches = files.filter((file) =>
      format.extensions.some((ext) => file.toLowerCase().endsWith(`.${ext.toLowerCase()}`)),
    );
    logger.info({
      bookId: book.id,
      format: format.name,
      extensions: format.extensions,
      matchCount: matches.length,
    }, "importer format matches");
    if (!matches.length) continue;
    const orderedMatches = sortNaturally(matches);

    if (orderedMatches.length > 1) {
      const extension = path.extname(orderedMatches[0])?.replace(/^\./, "") || format.extensions[0] || "m4b";
      throw new MultiFileImportError(book.id, book.title, format.name, orderedMatches, extension);
    }

    const found = orderedMatches[0];
    const destinationDirectory = getBookDirectory(
      JSON.parse(book.authorsJson ?? "[]"),
      book.title,
      options.libraryRoot,
    );

    await fs.mkdir(destinationDirectory, { recursive: true });
    const destinationPath = path.join(destinationDirectory, path.basename(found));

    await moveFile(found, destinationPath);

    const stats = await fs.stat(destinationPath);
    await db.insert(bookFiles).values({
      bookId: book.id,
      path: destinationPath,
      format: format.name,
      size: stats.size,
    });

    await db
      .update(books)
      .set({ state: "AVAILABLE" })
      .where(eq(books.id, book.id));

    await emitActivity("IMPORT_COMPLETED", `Imported file for ${book.title}`, book.id);
    await emitActivity("BOOK_AVAILABLE", `${book.title} is now available`, book.id);
    logger.info({ bookId: book.id, destinationPath }, "imported audiobook");
    return destinationPath;
  }

  const fallbackMultiTrack = detectFallbackMultiTrack(files);
  if (fallbackMultiTrack) {
    logger.info({
      bookId: book.id,
      extension: fallbackMultiTrack.extension,
      count: fallbackMultiTrack.files.length,
    }, "importer fallback multi-track detected");
    throw new MultiFileImportError(
      book.id,
      book.title,
      `${fallbackMultiTrack.extension.toUpperCase()} (unconfigured)`,
      fallbackMultiTrack.files,
      fallbackMultiTrack.extension,
    );
  }

  throw new Error("No matching files found for import");
}

async function moveFile(source: string, destination: string) {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "EXDEV") {
      await copyAndRemove(source, destination);
      return;
    }
    throw error;
  }
}

async function copyAndRemove(source: string, destination: string) {
  await new Promise<void>((resolve, reject) => {
    const readStream = createReadStream(source);
    const writeStream = createWriteStream(destination);
    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("close", () => resolve());
    readStream.pipe(writeStream);
  });
  try {
    await fs.unlink(source);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "EACCES" || err.code === "EPERM") {
      logger.warn({ source }, "unable to remove source file after copy");
      return;
    }
    throw error;
  }
}

async function collectFiles(targetPath: string) {
  const stats = await fs.stat(targetPath);
  if (stats.isFile()) {
    return [targetPath];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".abr-")) {
        continue;
      }
      files.push(...(await collectFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function sortNaturally(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function detectFallbackMultiTrack(files: string[]) {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const extension = path.extname(file)?.replace(/^\./, "").toLowerCase();
    if (!extension || !FALLBACK_TRACK_EXTENSIONS.has(extension)) {
      continue;
    }
    const group = groups.get(extension) ?? [];
    group.push(file);
    groups.set(extension, group);
  }
  for (const [extension, group] of groups.entries()) {
    if (group.length > 1) {
      return { extension, files: sortNaturally(group) };
    }
  }
  return null;
}
