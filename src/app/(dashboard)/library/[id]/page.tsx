import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getBook } from "@/lib/services/books";
import { db } from "@/db/client";
import { activityEvents, books, bookFiles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookQuickActions } from "@/ui/components/book-quick-actions";


export const metadata: Metadata = {
  title: "EBR · Book detail",
};

export default async function LibraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = Number(id);
  const book = await getBook(bookId);
  if (!book) {
    notFound();
  }
  const version = (book.updatedAt ?? book.createdAt)?.valueOf?.() ?? Date.now();

  const authors = JSON.parse(book.authorsJson ?? "[]") as string[];
  const files = await db.select().from(bookFiles).where(eq(bookFiles.bookId, bookId));
  const events = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.bookId, bookId))
    .orderBy(desc(activityEvents.ts))
    .limit(10);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full max-w-xs">
          {book.coverPath || book.coverUrl ? (
            <img
              src={book.coverPath ? `/api/books/${book.id}/cover?v=${version}` : book.coverUrl ?? ""}
              alt={book.title}
              className="h-80 w-full rounded-2xl border bg-muted object-contain p-3"
            />
          ) : (
            <div className="flex h-80 w-full items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
              No cover yet
            </div>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/library" className="text-sm text-muted-foreground hover:underline">
                ← Back to Library
              </Link>
              <BookQuickActions bookId={book.id} bookTitle={book.title} />
            </div>
            <h1 className="text-3xl font-semibold">{book.title}</h1>
            <p className="text-muted-foreground">
              {authors.length ? authors.join(", ") : "Unknown author"}
            </p>
          </div>
          <Badge variant={book.state === "AVAILABLE" ? "default" : "secondary"}>{book.state}</Badge>
          <dl className="grid gap-3 text-sm">
            {book.publishYear && (
              <div>
                <dt className="text-muted-foreground">Publish year</dt>
                <dd>{book.publishYear}</dd>
              </div>
            )}
            {book.isbn10 && (
              <div>
                <dt className="text-muted-foreground">ISBN-10</dt>
                <dd>{book.isbn10}</dd>
              </div>
            )}
            {book.isbn13 && (
              <div>
                <dt className="text-muted-foreground">ISBN-13</dt>
                <dd>{book.isbn13}</dd>
              </div>
            )}
            {files.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Files</dt>
                <dd className="space-y-1">
                  {files.map((file) => (
                    <div key={file.id} className="rounded border px-3 py-1 text-xs text-muted-foreground">
                      {file.path}
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          {book.description && (
            <div>
              <h2 className="text-base font-semibold">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{book.description}</p>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {events.length === 0 && <p className="text-muted-foreground">No events for this book yet.</p>}
          {events.map((event) => {
            const dateValue = event.ts ? new Date(event.ts) : null;
            const formatted = dateValue && !Number.isNaN(dateValue.valueOf()) ? dateValue.toLocaleString() : "Recently";
            return (
              <div key={event.id} className="border-l-2 border-primary pl-3">
                <p className="text-muted-foreground text-xs">
                  {formatted} · {event.type}
                </p>
                <p>{event.message}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
