import Link from "next/link";
import { Metadata } from "next";
import { listBooks } from "@/lib/services/books";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "EBR · Library",
};

export default async function LibraryPage() {
  const books = await listBooks();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground text-sm">Tracked works and their current automation state.</p>
      </div>
      <div className="flex flex-wrap gap-6">
        {books.map((book) => {
          const authors = JSON.parse(book.authorsJson ?? "[]") as string[];
          const version = (book.updatedAt ?? book.createdAt)?.valueOf?.() ?? Date.now();
          const imageSrc = book.coverPath
            ? `/api/books/${book.id}/cover?v=${version}`
            : book.coverUrl ?? null;

          return (
            <Link
              key={book.id}
              href={`/library/${book.id}`}
              className="group w-[260px] overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-1"
            >
              <div className="relative w-full overflow-hidden">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={book.title}
                    className="h-80 w-full rounded-2xl border bg-muted object-contain p-3 transition duration-300 group-hover:scale-[1.01]"
                  />
                ) : (
                  <div className="flex h-80 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
                    No cover yet
                  </div>
                )}
                <Badge
                  variant={book.state === "AVAILABLE" ? "default" : "secondary"}
                  className="absolute right-3 top-3"
                >
                  {book.state}
                </Badge>
              </div>
              <div className="px-4 py-3">
                <p className="text-base font-medium">{book.title}</p>
                <p className="text-sm text-muted-foreground">
                  {authors.length ? authors.join(", ") : "Unknown author"}
                </p>
              </div>
            </Link>
          );
        })}
        {books.length === 0 && <p className="text-muted-foreground">No books added yet.</p>}
      </div>
    </section>
  );
}
