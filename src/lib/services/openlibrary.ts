import { env } from "@/config";
import { RateLimiter } from "@/lib/services/rate-limiter";

const limiter = new RateLimiter(5, 1000);

export type OpenLibrarySearchDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  edition_key?: string[];
  isbn?: string[];
};

export type OpenLibrarySearchResponse = {
  docs: OpenLibrarySearchDoc[];
};

export type NormalizedBook = {
  workId: string;
  editionId?: string;
  title: string;
  authors: string[];
  publishYear?: number;
  description?: string;
  isbn10?: string;
  isbn13?: string;
  coverUrl?: string;
};

export async function searchBooks(query: string) {
  if (!query.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    limit: "20",
  });

  const url = `${env.OPEN_LIBRARY_BASE_URL}/search.json?${params.toString()}`;
  const data = await limiter.schedule(async () => {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      throw new Error(`Open Library search failed: ${response.status}`);
    }
    return (await response.json()) as OpenLibrarySearchResponse;
  });

  return data.docs.map(normalizeSearchDoc);
}

export async function getWork(workId: string) {
  const url = `${env.OPEN_LIBRARY_BASE_URL}/works/${workId}.json`;
  return limiter.schedule(async () => {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      throw new Error(`Open Library work fetch failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  });
}

export async function getEdition(editionId: string) {
  const url = `${env.OPEN_LIBRARY_BASE_URL}/books/${editionId}.json`;
  return limiter.schedule(async () => {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      throw new Error(`Open Library edition fetch failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  });
}

export async function getNormalizedBook(workId: string, editionId?: string) {
  const [work, edition] = await Promise.all([
    getWork(workId),
    editionId ? getEdition(editionId) : Promise.resolve(undefined),
  ]);

  return normalizeWork(work, edition);
}

export function normalizeWork(work: Record<string, unknown>, edition?: Record<string, unknown>): NormalizedBook {
  const title = typeof work.title === "string" ? work.title : "Unknown Title";
  const authors = Array.isArray(work.authors)
    ? work.authors
        .map((entry) =>
          typeof entry === "object" && entry !== null && "name" in entry
            ? String((entry as Record<string, unknown>).name)
            : undefined,
        )
        .filter(Boolean)
        .map(String)
    : [];

  const description = parseDescription(work.description ?? edition?.description);
  const identifiers = extractIdentifiers(edition);

  return {
    workId: String(work.key ?? "" ).replace("/works/", ""),
    editionId: edition?.key ? String(edition.key).replace("/books/", "") : undefined,
    title,
    authors,
    publishYear: typeof work.first_publish_date === "string" ? Number(work.first_publish_date) : undefined,
    description,
    isbn10: identifiers.isbn10,
    isbn13: identifiers.isbn13,
    coverUrl: buildCoverUrl(work, edition),
  };
}

function parseDescription(description: unknown) {
  if (typeof description === "string") {
    return description;
  }
  if (
    typeof description === "object" &&
    description !== null &&
    "value" in description &&
    typeof (description as Record<string, unknown>).value === "string"
  ) {
    return String((description as Record<string, unknown>).value);
  }
  return undefined;
}

function extractIdentifiers(data?: Record<string, unknown>) {
  if (!data || typeof data !== "object") {
    return {} as { isbn10?: string; isbn13?: string };
  }

  const identifiers = data.identifiers as Record<string, string[]> | undefined;
  const isbn10 = identifiers?.isbn_10?.[0];
  const isbn13 = identifiers?.isbn_13?.[0];

  return { isbn10, isbn13 };
}

function buildCoverUrl(work: Record<string, unknown>, edition?: Record<string, unknown>) {
  const coverId = (edition?.covers as number[] | undefined)?.[0] ?? (work.covers as number[] | undefined)?.[0];
  if (!coverId) {
    return undefined;
  }
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

export function normalizeSearchDoc(doc: OpenLibrarySearchDoc): NormalizedBook {
  const firstIsbn = doc.isbn?.[0];
  const isbn10 = firstIsbn && firstIsbn.length === 10 ? firstIsbn : undefined;
  const isbn13 = firstIsbn && firstIsbn.length === 13 ? firstIsbn : undefined;

  return {
    workId: doc.key.replace("/works/", ""),
    editionId: doc.edition_key?.[0],
    title: doc.title,
    authors: doc.author_name ?? [],
    publishYear: doc.first_publish_year,
    isbn10,
    isbn13,
  };
}
