"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/ui/components/toast-provider";
import { useManualSearchModal } from "@/ui/components/manual-search-context";

interface BookQuickActionsProps {
  bookId: number;
  bookTitle: string;
}

export function BookQuickActions({ bookId, bookTitle }: BookQuickActionsProps) {
  const manualSearch = useManualSearchModal();
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState<string | null>(null);
  const [automaticSearchPending, setAutomaticSearchPending] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({ title: bookTitle, authors: "", cover: null as File | null });

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

  useEffect(() => {
    if (!isEditOpen) return;
    setEditStatus("Loading book details…");
    fetch(`/api/books/${bookId}/edit`)
      .then((response) => response.json())
      .then((payload) => {
        setEditForm({
          title: payload?.data?.title ?? bookTitle,
          authors: (payload?.data?.authors ?? []).join(", "),
          cover: null,
        });
        setEditStatus(null);
      })
      .catch(() => setEditStatus("Failed to load book details"));
  }, [isEditOpen, bookId, bookTitle]);

  const deleteBook = async () => {
    if (!confirm(`Delete ${bookTitle}?`)) return;
    await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    router.push("/library");
    router.refresh();
  };

  const openEditModal = () => {
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditStatus(null);
    setEditForm({ title: bookTitle, authors: "", cover: null });
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditLoading(true);
    setEditStatus("Saving changes…");
    try {
      const formData = new FormData();
      formData.append("title", editForm.title.trim());
      formData.append("authors", editForm.authors.trim());
      if (editForm.cover) {
        formData.append("cover", editForm.cover);
      }
      const response = await fetch(`/api/books/${bookId}/edit`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "Failed to save changes");
      }
      showToast("Book updated", "success");
      closeEditModal();
      router.refresh();
    } catch (error) {
      setEditStatus(error instanceof Error ? error.message : "Unable to save changes");
      showToast("Failed to update book", "error");
    } finally {
      setEditLoading(false);
    }
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
        <Button size="sm" onClick={openEditModal}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={deleteBook}>
          Delete
        </Button>
      </div>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-semibold">Edit Book</h3>
              <p className="text-sm text-muted-foreground">
                {editStatus ?? "Update the title, authors, or upload a new cover."}
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div>
                <Label htmlFor="book-title">Title</Label>
                <Input
                  id="book-title"
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="book-authors">Authors (comma separated)</Label>
                <Input
                  id="book-authors"
                  value={editForm.authors}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, authors: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="book-cover">Cover image</Label>
                <Input
                  id="book-cover"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, cover: event.target.files?.[0] ?? null }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP, up to 10 MB.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeEditModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
