import slugify from "@sindresorhus/slugify";
import { Format } from "@/db/schema";
import { Book } from "@/db/schema";

const AUDIOBOOK_TERMS = [/audiobook/i, /mp3/i, /flac/i, /m4b/i];
const COMIC_TERMS = [/comic/i, /cbr/i, /cbz/i];
const ISBN_REGEX = /(97(8|9))?\d{9}(\d|X)/g;

export type ReleaseCandidate = {
  guid: string;
  title: string;
  link: string;
  size?: number;
  category?: number;
  publishedAt?: string;
  indexerId: number;
};

export type MatchResult = {
  release: ReleaseCandidate;
  score: number;
  detectedFormat?: Format;
};

export function scoreRelease(
  book: Book,
  release: ReleaseCandidate,
  formats: Format[],
): MatchResult | null {
  if (isAudioOrComic(release.title)) {
    return null;
  }

  const normalizedBookTitle = normalize(book.title);
  const normalizedReleaseTitle = normalize(release.title);
  const authorScore = computeAuthorScore(book);
  const titleScore = similarity(normalizedBookTitle, normalizedReleaseTitle);
  const isbnScore = findIsbnMatch(book, release.title) ? 0.4 : 0;
  const detectedFormat = detectFormat(release.title, formats);
  const formatScore = detectedFormat ? 0.3 + (1 / (detectedFormat.priority + 1)) * 0.1 : 0;

  const totalScore = Number((authorScore + titleScore + isbnScore + formatScore).toFixed(2));

  if (totalScore < 0.45) {
    return null;
  }

  return {
    release,
    score: totalScore,
    detectedFormat,
  };
}

function normalize(value: string) {
  return slugify(value, { separator: " " });
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const tokensA = new Set(a.split(" "));
  const tokensB = new Set(b.split(" "));
  const intersection = [...tokensA].filter((token) => tokensB.has(token));
  return intersection.length / Math.max(tokensA.size, tokensB.size);
}

function computeAuthorScore(book: Book) {
  const authors: string[] = JSON.parse(book.authorsJson);
  if (!authors.length) return 0;
  return 0.2;
}

function findIsbnMatch(book: Book, releaseTitle: string) {
  const matches = releaseTitle.match(ISBN_REGEX) ?? [];
  return matches.some((isbn) => isbn === book.isbn10 || isbn === book.isbn13);
}

function detectFormat(title: string, formats: Format[]) {
  return formats.find((format) => {
    const extensions: string[] = JSON.parse(format.extensions ?? "[]");
    return extensions.some((extension) => new RegExp(extension, "i").test(title));
  });
}

function isAudioOrComic(title: string) {
  return AUDIOBOOK_TERMS.some((regex) => regex.test(title)) || COMIC_TERMS.some((regex) => regex.test(title));
}
