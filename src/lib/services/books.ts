import { and, eq, like } from "drizzle-orm";
import fs from "node:fs/promises";
import { eq as drizzleEq } from "drizzle-orm";
import { db } from "@/db/client";

import { books } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs/queue";
import { addBookSchema } from "@/lib/validation/schemas";
import { getNormalizedBook } from "@/lib/services/openlibrary";
import { getSettings } from "@/lib/services/settings";
import { ensureLibraryRootSync, DEFAULT_LIBRARY_ROOT } from "@/lib/runtime/bootstrap";
import { getBookDirectory } from "@/lib/library/paths";
import { downloadCoverImage } from "@/lib/library/covers";
import { logger } from "@/lib/logger";

export async function listBooks({
  state,
  search,
}: {
  state?: string;
  search?: string;
} = {}) {
  return db.query.books.findMany({
    where: (fields, operators) => {
      const { and, eq: eqOp, like } = operators;
      const clauses = [] as any[];
      if (state) {
        clauses.push(eqOp(fields.state, state));
      }
      if (search) {
        clauses.push(like(fields.title, `%${search}%`));
      }
      if (clauses.length === 0) {
        return undefined;
      }
      if (clauses.length === 1) {
        return clauses[0];
      }
      return and(...clauses);
    },
    orderBy: (fields, { desc }) => desc(fields.createdAt),
  });
}

export async function getBook(id: number) {
  return db.query.books.findFirst({ where: (fields, { eq: eqOp }) => eqOp(fields.id, id) });
}

export async function addBook(payload: unknown) {
  const input = addBookSchema.parse(payload);
  const existing = await db.query.books.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.openLibraryWorkId, input.workId),
  });

  if (existing) {
    return existing;
  }

  const normalized = await getNormalizedBook(input.workId, input.editionId);
  const settings = await getSettings();
  const libraryRoot = settings?.libraryRoot ?? DEFAULT_LIBRARY_ROOT;
  await ensureLibraryRootSync(libraryRoot);

  const authors = normalized.authors.length ? normalized.authors : ["unknown-author"];
  const bookDirectory = getBookDirectory(authors, normalized.title, libraryRoot);
  await fs.mkdir(bookDirectory, { recursive: true });

  let coverPath: string | undefined;
  if (normalized.coverUrl) {
    try {
      coverPath = await downloadCoverImage(normalized.coverUrl, bookDirectory);
    } catch (error) {
      logger.warn({ error, workId: normalized.workId }, "failed to download cover image");
    }
  }

  const [book] = await db
    .insert(books)
    .values({
      openLibraryWorkId: normalized.workId,
      openLibraryEditionId: normalized.editionId,
      title: normalized.title,
      authorsJson: JSON.stringify(authors),
      publishYear: normalized.publishYear,
      description: normalized.description,
      isbn10: normalized.isbn10,
      isbn13: normalized.isbn13,
      coverUrl: normalized.coverUrl,
      coverPath,
      state: "MISSING",
    })
    .returning();

  await emitActivity("BOOK_ADDED", `Added ${book.title}`, book.id);
  await enqueueJob("SEARCH_BOOK", { bookId: book.id });

  return book;
}

export async function deleteBook(id: number) {
  await db.delete(books).where(drizzleEq(books.id, id));
}
