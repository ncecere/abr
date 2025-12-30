"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Book } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useManualSearchModal } from "@/ui/components/manual-search-context";
import { MoreHorizontal } from "lucide-react";

interface LibraryGridProps {
  books: Book[];
}

export function LibraryGrid({ books }: LibraryGridProps) {
  const [items, setItems] = useState(books);
  const [status, setStatus] = useState<string | null>(null);
  const manualSearch = useManualSearchModal();
  const router = useRouter();

  const refresh = () => router.refresh();

  const handleManualSearch = (book: Book) => {
    manualSearch.openModal({ id: book.id, title: book.title });
  };

  const handleAutomaticSearch = async (book: Book) => {
    setStatus(`Searching for "${book.title}"…`);
    try {
      const response = await fetch(`/api/books/${book.id}/search`, { method: "POST" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Automatic search failed");
      }
      const payload = await response.json().catch(() => null);
      const releaseTitle = payload?.data?.releaseTitle ?? book.title;
      setStatus(`Queued download for "${releaseTitle}"`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Automatic search failed");
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Delete ${book.title}?`)) return;
    setStatus(`Deleting ${book.title}…`);
    try {
      const response = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Delete failed");
      }
      setItems((current) => current.filter((entry) => entry.id !== book.id));
      setStatus(`${book.title} deleted`);
      refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete book");
    }
  };

  return (
    <div className="space-y-4">
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      <div className="flex flex-wrap gap-6">
        {items.map((book) => {
          const authors = JSON.parse(book.authorsJson ?? "[]") as string[];
          const version = (book.updatedAt ?? book.createdAt)?.valueOf?.() ?? 0;
          const imageSrc = book.coverPath
            ? `/api/books/${book.id}/cover?v=${version}`
            : book.coverUrl ?? null;

          return (
            <div
              key={book.id}
              className="w-[260px] overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <Link href={`/library/${book.id}`} className="block group">
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
              </Link>
              <div className="relative px-4 pb-4">
                <div className="py-3 pr-10">
                  <p className="text-base font-medium">{book.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {authors.length ? authors.join(", ") : "Unknown author"}
                  </p>
                </div>
                <div className="absolute bottom-3 right-3 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      type="button"
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Book actions</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAutomaticSearch(book)}>
                        Automatic Search
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleManualSearch(book)}>
                        Manual Search
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/library/${book.id}`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(book)} className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-muted-foreground">No books added yet.</p>}
      </div>
    </div>
  );
}
