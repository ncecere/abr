import { Metadata } from "next";
import { db } from "@/db/client";
import { books } from "@/db/schema";
import { SearchClient } from "@/ui/components/search-client";

export const metadata: Metadata = {
  title: "ABR · Search",
};

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const existing = await db.select({ asin: books.audibleAsin }).from(books);
  const existingAsins = existing.map((entry) => entry.asin).filter(Boolean) as string[];

  return (
    <section className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Search Audible</h1>
        <p className="text-muted-foreground text-sm">Find audiobooks and add them to the automated pipeline.</p>
      </div>
      <SearchClient existingAsins={existingAsins} />
    </section>
  );
}
