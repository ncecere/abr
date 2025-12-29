import { and, eq, like } from "drizzle-orm";
import { db } from "@/db/client";
import { books } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs/queue";
import { addBookSchema } from "@/lib/validation/schemas";
import { getNormalizedBook } from "@/lib/services/openlibrary";

export async function listBooks({
  state,
  search,
}: {
  state?: string;
  search?: string;
} = {}) {
  return db.query.books.findMany({
    where: (fields, operators) => {
      const clauses = [] as any[];
      if (state) {
        clauses.push(operators.eq(fields.state, state));
      }
      if (search) {
        clauses.push(operators.like(fields.title, `%${search}%`));
      }
      return clauses.length ? operators.and(...clauses) : undefined;
    },
    orderBy: (fields, { desc }) => desc(fields.createdAt),
  });
}

export async function getBook(id: number) {
  return db.query.books.findFirst({ where: (fields, { eq }) => eq(fields.id, id) });
}

export async function addBook(payload: unknown) {
  const input = addBookSchema.parse(payload);
  const existing = await db.query.books.findFirst({
    where: (fields, { eq }) => eq(fields.openLibraryWorkId, input.workId),
  });

  if (existing) {
    return existing;
  }

  const normalized = await getNormalizedBook(input.workId, input.editionId);

  const [book] = await db
    .insert(books)
    .values({
      openLibraryWorkId: normalized.workId,
      openLibraryEditionId: normalized.editionId,
      title: normalized.title,
      authorsJson: JSON.stringify(normalized.authors),
      publishYear: normalized.publishYear,
      description: normalized.description,
      isbn10: normalized.isbn10,
      isbn13: normalized.isbn13,
      coverUrl: normalized.coverUrl,
      state: "MISSING",
    })
    .returning();

  await emitActivity("BOOK_ADDED", `Added ${book.title}`, book.id);
  await enqueueJob("SEARCH_BOOK", { bookId: book.id });

  return book;
}

export async function deleteBook(id: number) {
  await db.delete(books).where(eq(books.id, id));
}
