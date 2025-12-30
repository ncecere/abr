"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useManualSearchModal } from "@/ui/components/manual-search-context";

interface BookQuickActionsProps {
  bookId: number;
  bookTitle: string;
}

export function BookQuickActions({ bookId, bookTitle }: BookQuickActionsProps) {
  const manualSearch = useManualSearchModal();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [automaticSearchPending, setAutomaticSearchPending] = useState(false);

  const automaticSearch = async () => {
    setAutomaticSearchPending(true);
    setStatus(`Searching for "${bookTitle}"…`);
    try {
      const response = await fetch(`/api/books/${bookId}/search`, { method: "POST" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Automatic search failed");
      }
      const payload = await response.json().catch(() => null);
      const releaseTitle = payload?.data?.releaseTitle ?? bookTitle;
      setStatus(`Queued download for "${releaseTitle}"`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Automatic search failed");
    } finally {
      setAutomaticSearchPending(false);
    }
  };

  const manualSearchAction = () => {
    manualSearch.openModal({ id: bookId, title: bookTitle });
  };

  const deleteBook = async () => {
    if (!confirm(`Delete ${bookTitle}?`)) return;
    await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    router.push("/library");
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={automaticSearch} disabled={automaticSearchPending}>
          Automatic Search
        </Button>
        <Button variant="secondary" size="sm" onClick={manualSearchAction}>
          Manual Search
        </Button>
        <Button size="sm" onClick={() => router.push(`/library/${bookId}`)}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={deleteBook}>
          Delete
        </Button>
      </div>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
