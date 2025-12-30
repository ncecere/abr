"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/ui/components/toast-provider";

export type SearchResult = {
  asin: string;
  productId?: string;
  title: string;
  authors: string[];
  narrators: string[];
  publishYear?: number;
  releaseDate?: string;
  runtimeSeconds?: number;
  language?: string;
  description?: string;
};

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

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

  const handleAdd = useCallback(
    async (result: SearchResult) => {
      try {
        const response = await fetch("/api/books", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ asin: result.asin }),
        });
        if (!response.ok) throw new Error("Failed to add book");
        showToast(`Queued ${result.title}`, "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to add book", "error");
      }
    },
    [showToast],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">Search Audible</label>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, author, or ASIN"
        />
      </div>
      <div className="grid gap-4">
        {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
        {!loading && results.length === 0 && query && (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        )}
        {results.map((result) => (
          <Card key={result.asin}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4 text-base">
                <span>
                  {result.title}{" "}
                  {formatReleaseYear(result.publishYear, result.releaseDate) && (
                    <span className="text-muted-foreground">
                      ({formatReleaseYear(result.publishYear, result.releaseDate)})
                    </span>
                  )}
                </span>
                <Button size="sm" onClick={() => handleAdd(result)}>
                  Add to Library
                </Button>
              </CardTitle>
              <CardDescription className="space-y-1">
                <p>{result.authors.length ? result.authors.join(", ") : "Unknown author"}</p>
                {result.narrators.length > 0 && (
                  <p className="text-xs">Narrated by {result.narrators.join(", ")}</p>
                )}
              </CardDescription>
            </CardHeader>
            {(result.runtimeSeconds || result.language || result.releaseDate || result.description) && (
              <CardContent className="space-y-2">
                {(result.runtimeSeconds || result.language || result.releaseDate) && (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {result.runtimeSeconds && <Badge variant="secondary">{formatRuntime(result.runtimeSeconds)}</Badge>}
                    {result.language && <Badge variant="outline">{result.language.toUpperCase()}</Badge>}
                    {result.releaseDate && <Badge variant="outline">Released {formatReleaseDate(result.releaseDate)}</Badge>}
                  </div>
                )}
                {result.description && (
                  <Textarea value={result.description} readOnly rows={3} className="resize-none" />
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatRuntime(seconds?: number) {
  if (!seconds || seconds <= 0) {
    return "Runtime unavailable";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return `${parts.join(" ") || `${Math.round(seconds / 60)}m`} runtime`;
}

function formatReleaseYear(publishYear?: number, releaseDate?: string) {
  if (publishYear) {
    return String(publishYear);
  }
  const fromDate = extractYear(releaseDate);
  return fromDate ?? undefined;
}

function formatReleaseDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function extractYear(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(\d{4})/);
  return match ? match[1] : undefined;
}

