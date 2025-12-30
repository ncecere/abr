import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { bookFiles, books } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { logger } from "@/lib/logger";
import { getBookDirectory } from "@/lib/library/paths";

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
  const normalizedFormats = options.formatExtensions.sort((a, b) => a.priority - b.priority);

  for (const format of normalizedFormats) {
    const found = files.find((file) => format.extensions.some((ext) => file.toLowerCase().endsWith(`.${ext.toLowerCase()}`)));
    if (!found) continue;

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
    logger.info({ bookId: book.id, destinationPath }, "imported ebook");
    return destinationPath;
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
      files.push(...(await collectFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
