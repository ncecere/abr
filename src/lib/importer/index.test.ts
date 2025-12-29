import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { importFileForBook } from "@/lib/importer";
import { db } from "@/db/client";
import { books, bookFiles } from "@/db/schema";

describe("importFileForBook", () => {
  it("copies the first matching format and records metadata", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ebr-test-"));

    const [book] = await db
      .insert(books)
      .values({
        openLibraryWorkId: "OL1W",
        title: "Test Book",
        authorsJson: JSON.stringify(["Example Author"]),
        state: "MISSING",
      })
      .returning();

    const downloadDir = path.join(tmpDir, "download");
    await fs.mkdir(downloadDir, { recursive: true });
    const sourceFile = path.join(downloadDir, "Test Book.epub");
    await fs.writeFile(sourceFile, "ebook");

    await importFileForBook({
      bookId: book.id,
      downloadPath: downloadDir,
      libraryRoot: tmpDir,
      formatExtensions: [{ name: "EPUB", extensions: ["epub"], priority: 0 }],
    });

    const files = await db
      .select()
      .from(bookFiles)
      .where(eq(bookFiles.bookId, book.id));
    expect(files.length).toBe(1);
    expect(files[0].format).toBe("EPUB");
  });
});
