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
  title: "ABR · Book detail",
};

const ACTIVITY_PAGE_SIZE = 10;

export default async function LibraryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const bookId = Number(id);
  const book = await getBook(bookId);
  if (!book) {
    notFound();
  }
  const currentPage = Math.max(1, Number(search?.page ?? "1") || 1);
  const offset = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
  const limit = ACTIVITY_PAGE_SIZE + 1;
  const version = (book.updatedAt ?? book.createdAt)?.valueOf?.() ?? Date.now();

  const authors = JSON.parse(book.authorsJson ?? "[]") as string[];
  const narrators = JSON.parse(book.narratorsJson ?? "[]") as string[];
  const files = await db.select().from(bookFiles).where(eq(bookFiles.bookId, bookId));
  const rawEvents = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.bookId, bookId))
    .orderBy(desc(activityEvents.ts))
    .limit(limit)
    .offset(offset);
  const hasNextPage = rawEvents.length > ACTIVITY_PAGE_SIZE;
  const events = rawEvents.slice(0, ACTIVITY_PAGE_SIZE);
  const hasPrevPage = currentPage > 1;
  const basePath = `/library/${book.id}`;
  const prevHref = currentPage <= 2 ? basePath : `${basePath}?page=${currentPage - 1}`;
  const nextHref = `${basePath}?page=${currentPage + 1}`;
  const startEntry = events.length ? offset + 1 : 0;
  const endEntry = offset + events.length;
  const paginationLinkClass = (enabled: boolean) =>
    enabled
      ? "text-sm font-medium text-primary hover:underline"
      : "text-sm text-muted-foreground pointer-events-none";

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
                <BookQuickActions bookId={book.id} bookTitle={book.title} bookState={book.state ?? "MISSING"} />
              </div>
              <h1 className="text-3xl font-semibold">{book.title}</h1>
              <p className="text-muted-foreground">
                <span className="font-medium">Author:</span> {authors.length ? authors.join(", ") : "Unknown"}
                {narrators.length > 0 && (
                  <>
                    {" "}· <span className="font-medium">Narrator:</span> {narrators.join(", ")}
                  </>
                )}
              </p>
            </div>

          <Badge variant={book.state === "AVAILABLE" ? "default" : "secondary"}>{book.state}</Badge>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-6 text-muted-foreground">
              <span>
                <span className="font-medium">ASIN:</span> {book.audibleAsin}
              </span>
              {book.publishYear && (
                <span>
                  <span className="font-medium">Year:</span> {book.publishYear}
                </span>
              )}
              {book.runtimeSeconds && (
                <span>
                  <span className="font-medium">Runtime:</span> {formatRuntime(book.runtimeSeconds)}
                </span>
              )}
              {book.language && (
                <span>
                  <span className="font-medium">Language:</span> {book.language.toUpperCase()}
                </span>
              )}
            </div>
            {book.sampleUrl && (
              <p>
                <span className="text-muted-foreground font-medium">Sample clip:</span>{" "}
                <a className="text-primary underline" href={book.sampleUrl} target="_blank" rel="noreferrer">
                  Listen preview
                </a>
              </p>
            )}
            {files.length > 0 && (
              <div>
                <p className="text-muted-foreground font-medium">Files</p>
                <div className="space-y-1">
                  {files.map((file) => (
                    <div key={file.id} className="rounded border px-3 py-1 text-xs text-muted-foreground">
                      {file.path}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          {(hasPrevPage || hasNextPage) && (
            <div className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {events.length ? `Showing ${startEntry}-${endEntry}` : "No events to display"}
              </span>
              <div className="flex gap-4">
                <Link href={prevHref} aria-disabled={!hasPrevPage} className={paginationLinkClass(hasPrevPage)}>
                  Previous
                </Link>
                <Link href={nextHref} aria-disabled={!hasNextPage} className={paginationLinkClass(hasNextPage)}>
                  Next
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function formatRuntime(seconds?: number | null) {
  if (!seconds || seconds <= 0) {
    return "Unknown";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(" ") || `${Math.round(seconds / 60)}m`;
}

function formatReleaseDate(value?: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString();
}
