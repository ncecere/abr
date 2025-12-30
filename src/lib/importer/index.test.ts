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

    const asin = `ASIN${Date.now()}`;
    const [book] = await db
      .insert(books)
      .values({
        audibleAsin: asin,
        title: "Test Book",
        authorsJson: JSON.stringify(["Example Author"]),
        narratorsJson: JSON.stringify(["Narrator"]),
        state: "MISSING",
      })
      .returning();

    const downloadDir = path.join(tmpDir, "download");
    await fs.mkdir(downloadDir, { recursive: true });
    const sourceFile = path.join(downloadDir, "Test Book.epub");
    await fs.writeFile(sourceFile, "audiobook");

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

    await db.delete(bookFiles).where(eq(bookFiles.bookId, book.id));
    await db.delete(books).where(eq(books.id, book.id));
  });
});
