"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ManualSearchBook = {
  id: number;
  title: string;
};

export type ManualSearchResult = {
  id: string;
  title: string;
  indexerName: string;
  indexerId: number;
  guid: string;
  link: string;
  size?: number;
};

interface ManualSearchContextValue {
  openModal: (book: ManualSearchBook) => void;
  closeModal: () => void;
}

const ManualSearchContext = createContext<ManualSearchContextValue | undefined>(undefined);

export function ManualSearchModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    open: false,
    loading: false,
    book: undefined as ManualSearchBook | undefined,
    results: [] as ManualSearchResult[],
    status: "",
    downloadStatuses: {} as Record<string, string>,
    downloadingId: null as string | null,
  });

  const openModal = (book: ManualSearchBook) => {
    setState({
      open: true,
      loading: true,
      book,
      results: [],
      status: "Searching indexers…",
      downloadStatuses: {},
      downloadingId: null,
    });
    fetch("/api/manual-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId: book.id }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.detail ?? "Search failed");
        }
        const { data } = (await response.json()) as { data: ManualSearchResult[] };
        setState((prev) => ({
          ...prev,
          loading: false,
          status: data.length ? "Select a result to download" : "No matching releases found",
          results: data,
        }));
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          status: error instanceof Error ? error.message : "Manual search failed",
        }));
      });
  };

  const closeModal = () => {
    setState((prev) => ({ ...prev, open: false }));
  };

  const queueDownload = async (result: ManualSearchResult) => {
    if (!state.book) return;
    const bookId = state.book.id;
    setState((prev) => ({
      ...prev,
      downloadingId: result.id,
      downloadStatuses: { ...prev.downloadStatuses, [result.id]: "Queuing download…" },
    }));
    try {
      const response = await fetch("/api/manual-search/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookId,
          indexerId: result.indexerId,
          guid: result.guid,
          link: result.link,
          title: result.title,
          size: result.size ?? null,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? "Failed to queue download");
      }
      setState((prev) => ({
        ...prev,
        downloadingId: null,
        downloadStatuses: { ...prev.downloadStatuses, [result.id]: "Download queued" },
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloadingId: null,
        downloadStatuses: {
          ...prev.downloadStatuses,
          [result.id]: error instanceof Error ? error.message : "Failed to queue download",
        },
      }));
    }
  };

  return (
    <ManualSearchContext.Provider value={{ openModal, closeModal }}>
      {children}
      {state.open && state.book ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-2xl space-y-4 rounded-2xl border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Manual search · {state.book.title}</h2>
                <p className="text-sm text-muted-foreground">{state.status}</p>
              </div>
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
            </div>
            {state.loading && <p className="text-sm text-muted-foreground">Searching…</p>}
            {!state.loading && (
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {state.results.map((result) => {
                  const isPending = state.downloadingId === result.id;
                  const statusMessage = state.downloadStatuses[result.id];
                  return (
                    <Card key={result.id}>
                      <CardContent className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-snug">{result.title}</p>
                          <p className="text-xs text-muted-foreground">{result.indexerName}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
                          <span>{result.size ? `${(result.size / (1024 * 1024)).toFixed(1)} MB` : "Size unknown"}</span>
                          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => queueDownload(result)}>
                            {isPending ? "Queuing…" : "Download"}
                          </Button>
                        </div>
                        {statusMessage && <p className="text-xs text-muted-foreground text-right">{statusMessage}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
                {state.results.length === 0 && !state.loading && (
                  <p className="text-sm text-muted-foreground">No results yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </ManualSearchContext.Provider>
  );
}

export function useManualSearchModal() {
  const ctx = useContext(ManualSearchContext);
  if (!ctx) {
    throw new Error("useManualSearchModal must be used within ManualSearchModalProvider");
  }
  return ctx;
}
