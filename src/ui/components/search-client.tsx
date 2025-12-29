"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type SearchResult = {
  workId: string;
  editionId?: string;
  title: string;
  authors: string[];
  publishYear?: number;
  description?: string;
};

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?query=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setResults(data.data ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const handleAdd = useCallback(async (result: SearchResult) => {
    setMessage(null);
    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workId: result.workId, editionId: result.editionId }),
      });
      if (!response.ok) throw new Error("Failed to add book");
      setMessage(`Queued ${result.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add book");
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">Search Open Library</label>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, author, or ISBN"
        />
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="grid gap-4">
        {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
        {!loading && results.length === 0 && query && (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        )}
        {results.map((result) => (
          <Card key={result.workId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4 text-base">
                <span>
                  {result.title} {result.publishYear && <span className="text-muted-foreground">({result.publishYear})</span>}
                </span>
                <Button size="sm" onClick={() => handleAdd(result)}>
                  Add to Library
                </Button>
              </CardTitle>
              <CardDescription>
                {result.authors.length ? result.authors.join(", ") : "Unknown author"}
              </CardDescription>
            </CardHeader>
            {result.description && (
              <CardContent>
                <Textarea value={result.description} readOnly rows={3} className="resize-none" />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
