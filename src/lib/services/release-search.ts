import pLimit from "p-limit";
import { env } from "@/config";
import { logger } from "@/lib/logger";
import { books, indexers, formats } from "@/db/schema";
import { queryNewznab } from "@/lib/services/newznab";
import { MatchResult, scoreRelease } from "@/lib/matching";

export const DEFAULT_AUDIOBOOK_CATEGORIES = [3030, 3035, 3036, 3040];
export const MAX_RELEASES_PER_INDEXER = 25;
const INDEXER_CONCURRENCY = 3;
const STRICT_NEGATIVE_KEYWORDS = "-part -disc -cd -track";
const STRICT_HINTS = ["m4b", "audiobook", "complete"];

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

export type IndexerFailure = {
  indexerId: number;
  name: string;
  reason: string;
};

export type SearchQueryPlan = {
  strict: string[];
  relaxed: string[];
};

export async function fetchReleasesAcrossIndexers(
  book: BookRecord,
  indexerList: IndexerRecord[],
  limitPerIndexer = 10,
) {
  const searchPlan = buildSearchQueries(book);
  const failures = new Map<number, IndexerFailure>();
  const limit = pLimit(INDEXER_CONCURRENCY);

  const perIndexerResults = await Promise.all(
    indexerList.map((indexer) =>
      limit(() =>
        searchIndexer(indexer, searchPlan, limitPerIndexer, failures),
      ),
    ),
  );

  return {
    releases: perIndexerResults.flat(),
    failures: Array.from(failures.values()),
  };
}

async function searchIndexer(
  indexer: IndexerRecord,
  searchPlan: SearchQueryPlan,
  limitPerIndexer: number,
  failures: Map<number, IndexerFailure>,
) {
  const categories = parseCategories(indexer.categories);
  const queryGroups = [searchPlan.strict, searchPlan.relaxed];

  for (const group of queryGroups) {
    for (const query of group) {
      if (!query) continue;
      try {
        const releases = await queryNewznab(
          { baseUrl: indexer.baseUrl, apiKey: indexer.apiKey, categories },
          query,
          limitPerIndexer,
          env.NEWZNAB_REQUEST_TIMEOUT_MS,
        );
        if (releases.length > 0) {
          return releases.map((release) => ({ indexer, release }));
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logger.warn({ indexerId: indexer.id, query, error: reason }, "indexer search failed");
        failures.set(indexer.id, { indexerId: indexer.id, name: indexer.name, reason });
        return [];
      }
    }
  }

  return [];
}

export async function findBestReleaseMatch(
  book: BookRecord,
  indexerList: IndexerRecord[],
  formatList: FormatRecord[],
  limitPerIndexer = MAX_RELEASES_PER_INDEXER,
) {
  const candidates: MatchResult[] = [];
  const { releases, failures } = await fetchReleasesAcrossIndexers(book, indexerList, limitPerIndexer);

  releases.forEach(({ release, indexer }) => {
    const scored = scoreRelease(book, { ...release, indexerId: indexer.id }, formatList);
    if (scored) {
      candidates.push(scored);
    }
  });

  return {
    bestMatch: candidates.sort((a, b) => b.score - a.score)[0] ?? null,
    failures,
  };
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

export function buildSearchQueries(book: BookRecord): SearchQueryPlan {
  const authors = safeParseAuthors(book.authorsJson);
  const normalizedTitle = normalizeQueryPart(book.title);
  const normalizedAuthor = normalizeQueryPart(authors[0]);
  const normalizedAsin = normalizeQueryPart(book.audibleAsin);
  const rawTitle = (book.title ?? "").trim();

  const strictQueries = [
    [normalizedTitle, normalizedAsin, ...STRICT_HINTS, STRICT_NEGATIVE_KEYWORDS],
    [normalizedTitle, normalizedAuthor, STRICT_HINTS[0], STRICT_NEGATIVE_KEYWORDS],
    [normalizedTitle, STRICT_HINTS[0], STRICT_NEGATIVE_KEYWORDS],
    [rawTitle, STRICT_HINTS[0], STRICT_NEGATIVE_KEYWORDS],
  ]
    .map((parts) => parts.filter(Boolean).join(" ").trim())
    .filter(Boolean);

  const relaxedQueries = [
    [normalizedTitle, normalizedAsin].filter(Boolean).join(" "),
    [normalizedTitle, normalizedAuthor].filter(Boolean).join(" "),
    normalizedTitle,
    normalizedAsin,
    rawTitle,
  ]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    strict: Array.from(new Set(strictQueries)),
    relaxed: Array.from(new Set(relaxedQueries.filter((query) => !strictQueries.includes(query)))),
  };
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
