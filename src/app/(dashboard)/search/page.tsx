import { Metadata } from "next";
import { SearchClient } from "@/ui/components/search-client";

export const metadata: Metadata = {
  title: "EBR · Search",
};

export default function SearchPage() {
  return (
    <section className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Search Open Library</h1>
        <p className="text-muted-foreground text-sm">Find works and add them to the automated pipeline.</p>
      </div>
      <SearchClient />
    </section>
  );
}
