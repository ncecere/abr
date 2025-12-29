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

export async function getAuthor(authorKey: string) {
  const normalized = authorKey.replace("/authors/", "");
  const url = `${env.OPEN_LIBRARY_BASE_URL}/authors/${normalized}.json`;
  return limiter.schedule(async () => {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      throw new Error(`Open Library author fetch failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  });
}

export async function getNormalizedBook(workId: string, editionId?: string) {
  const [work, edition] = await Promise.all([
    getWork(workId),
    editionId ? getEdition(editionId) : Promise.resolve(undefined),
  ]);
  const authors = await resolveAuthorNames(work, edition);
  return normalizeWork(work, edition, authors);
}

export function normalizeWork(
  work: Record<string, unknown>,
  edition?: Record<string, unknown>,
  authors: string[] = [],
): NormalizedBook {
  const title = typeof work.title === "string" ? work.title : typeof edition?.title === "string" ? String(edition.title) : "Unknown Title";
  const description = parseDescription(work.description ?? edition?.description);
  const identifiers = extractIdentifiers(edition);

  return {
    workId: String(work.key ?? "").replace("/works/", ""),
    editionId: edition?.key ? String(edition.key).replace("/books/", "") : undefined,
    title,
    authors,
    publishYear: resolvePublishYear(work, edition),
    description,
    isbn10: identifiers.isbn10,
    isbn13: identifiers.isbn13,
    coverUrl: buildCoverUrl(work, edition),
  };
}

async function resolveAuthorNames(work: Record<string, unknown>, edition?: Record<string, unknown>) {
  const workRefs = extractAuthorRefs((work as any)?.authors);
  const editionRefs = extractAuthorRefs((edition as any)?.authors);
  const initialNames = [...workRefs.names, ...editionRefs.names].filter(Boolean);
  const uniqueKeys = Array.from(new Set([...workRefs.keys, ...editionRefs.keys]));

  const fetched = await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        const author = await getAuthor(key);
        return typeof author.name === "string" ? author.name : undefined;
      } catch {
        return undefined;
      }
    }),
  );

  const combined = [...initialNames, ...fetched.filter(Boolean)] as string[];
  return Array.from(new Set(combined.map((name) => name.trim()).filter(Boolean)));
}

function extractAuthorRefs(value: unknown): { names: string[]; keys: string[] } {
  const result = { names: [] as string[], keys: [] as string[] };
  if (!Array.isArray(value)) {
    return result;
  }

  for (const entry of value) {
    if (typeof entry === "string") {
      result.names.push(entry);
      continue;
    }
    if (typeof entry === "object" && entry !== null) {
      const maybeName = (entry as Record<string, unknown>).name;
      if (typeof maybeName === "string") {
        result.names.push(maybeName);
      }
      const authorObject = (entry as Record<string, unknown>).author;
      if (authorObject && typeof authorObject === "object" && authorObject !== null && "key" in authorObject) {
        const key = (authorObject as Record<string, unknown>).key;
        if (typeof key === "string") {
          result.keys.push(key.replace("/authors/", ""));
        }
      } else if ("key" in (entry as Record<string, unknown>)) {
        const key = (entry as Record<string, unknown>).key;
        if (typeof key === "string") {
          result.keys.push(key.replace("/authors/", ""));
        }
      }
    }
  }

  return result;
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
  const rawIsbn10 = (identifiers?.isbn_10 ?? ((data as Record<string, unknown> as any)?.isbn_10)) as string[] | undefined;
  const rawIsbn13 = (identifiers?.isbn_13 ?? ((data as Record<string, unknown> as any)?.isbn_13)) as string[] | undefined;
  const isbn10 = rawIsbn10?.[0];
  const isbn13 = rawIsbn13?.[0];

  return { isbn10, isbn13 };
}

function buildCoverUrl(work: Record<string, unknown>, edition?: Record<string, unknown>) {
  const coverId = (edition?.covers as number[] | undefined)?.[0] ?? (work.covers as number[] | undefined)?.[0];
  if (!coverId) {
    return undefined;
  }
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

function resolvePublishYear(work: Record<string, unknown>, edition?: Record<string, unknown>) {
  const workData = work as any;
  const editionData = edition as any;
  const candidates = [
    workData?.first_publish_date,
    editionData?.publish_date,
    editionData?.publish_year,
    workData?.created?.value,
    editionData?.created?.value,
  ];

  for (const candidate of candidates) {
    const year = parseYear(candidate);
    if (year) {
      return year;
    }
  }
  return undefined;
}

function parseYear(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const match = value.match(/(\d{4})/);
    if (match) {
      return Number(match[1]);
    }
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseYear(entry);
      if (parsed) {
        return parsed;
      }
    }
  }
  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    return parseYear((value as Record<string, unknown>).value);
  }
  return undefined;
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
