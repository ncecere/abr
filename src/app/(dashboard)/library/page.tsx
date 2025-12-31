import Link from "next/link";
import { Metadata } from "next";
import { listBooks } from "@/lib/services/books";
import { LibraryGrid } from "@/ui/components/library-grid";

export const metadata: Metadata = {
  title: "ABR · Library",
};

export default async function LibraryPage() {
  const books = await listBooks();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground text-sm">Tracked works and their current automation state.</p>
      </div>
      <LibraryGrid books={books} />
    </section>
  );
}
