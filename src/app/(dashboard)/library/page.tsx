import { Metadata } from "next";
import { listBooks } from "@/lib/services/books";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="grid gap-4 md:grid-cols-2">
        {books.map((book) => (
          <Card key={book.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{book.title}</CardTitle>
                <CardDescription>{JSON.parse(book.authorsJson).join(", ")}</CardDescription>
              </div>
              <Badge variant={book.state === "AVAILABLE" ? "default" : "secondary"}>{book.state}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {book.description && <p className="line-clamp-3">{book.description}</p>}
              <p>Added {new Date(book.createdAt).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
        {books.length === 0 && <p className="text-muted-foreground">No books added yet.</p>}
      </div>
    </section>
  );
}
