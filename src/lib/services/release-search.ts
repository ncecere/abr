import { books, indexers, formats } from "@/db/schema";
import { queryNewznab } from "@/lib/services/newznab";
import { MatchResult, scoreRelease } from "@/lib/matching";

export const DEFAULT_AUDIOBOOK_CATEGORIES = [3030, 3035, 3036, 3040];
export const MAX_RELEASES_PER_INDEXER = 25;

export type BookRecord = typeof books.$inferSelect;
export type IndexerRecord = typeof indexers.$inferSelect;
export type FormatRecord = typeof formats.$inferSelect;

export type IndexerRelease = {
  indexer: IndexerRecord;
  release: {
    guid: string;
    title: string;
    link: string;
    size?: number;
  };
};

export async function fetchReleasesAcrossIndexers(
  book: BookRecord,
  indexerList: IndexerRecord[],
  limitPerIndexer = 10,
) {
  const searchQueries = buildSearchQueries(book);
  const aggregated: IndexerRelease[] = [];

  for (const indexer of indexerList) {
    const categories = parseCategories(indexer.categories);
    let releases: Awaited<ReturnType<typeof queryNewznab>> = [];

    for (const query of searchQueries) {
      releases = await queryNewznab(
        { baseUrl: indexer.baseUrl, apiKey: indexer.apiKey, categories },
        query,
        limitPerIndexer,
      );
      if (releases.length > 0) {
        break;
      }
    }

    releases.forEach((release) => {
      aggregated.push({ indexer, release });
    });
  }

  return aggregated;
}

export async function findBestReleaseMatch(
  book: BookRecord,
  indexerList: IndexerRecord[],
  formatList: FormatRecord[],
  limitPerIndexer = MAX_RELEASES_PER_INDEXER,
) {
  const candidates: MatchResult[] = [];
  const releases = await fetchReleasesAcrossIndexers(book, indexerList, limitPerIndexer);

  releases.forEach(({ release, indexer }) => {
    const scored = scoreRelease(book, { ...release, indexerId: indexer.id }, formatList);
    if (scored) {
      candidates.push(scored);
    }
  });

  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

export function parseCategories(raw: string | null) {
  if (!raw) {
    return DEFAULT_AUDIOBOOK_CATEGORIES;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value) && value > 0);
      return normalized.length ? normalized : DEFAULT_AUDIOBOOK_CATEGORIES;
    }
  } catch {
    // ignore JSON errors
  }
  return DEFAULT_AUDIOBOOK_CATEGORIES;
}

export function buildSearchQueries(book: BookRecord) {
  const authors = safeParseAuthors(book.authorsJson);
  const normalizedTitle = normalizeQueryPart(book.title);
  const normalizedAuthor = normalizeQueryPart(authors[0]);
  const normalizedAsin = normalizeQueryPart(book.audibleAsin);
  const rawTitle = (book.title ?? "").trim();

  const queries = [
    [normalizedTitle, normalizedAsin].filter(Boolean).join(" "),
    [normalizedTitle, normalizedAuthor].filter(Boolean).join(" "),
    normalizedTitle,
    normalizedAsin,
    rawTitle,
  ]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(queries));
}

function safeParseAuthors(raw: string | null) {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? (parsed.filter((entry) => typeof entry === "string") as string[]) : [];
  } catch {
    return [];
  }
}

function normalizeQueryPart(value?: string) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
