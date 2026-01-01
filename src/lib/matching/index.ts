import slugify from "@sindresorhus/slugify";
import { Format } from "@/db/schema";
import { Book } from "@/db/schema";

const AUDIOBOOK_TERMS = [/audiobook/i, /m4b/i, /flac/i, /mp3/i, /unabridged/i, /kbps/i];
const EBOOK_TERMS = [/ebook/i, /epub/i, /mobi/i, /pdf/i, /azw/i];
const COMIC_TERMS = [/comic/i, /cbr/i, /cbz/i];

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

const MULTIPART_PATTERNS = [
  /\bpart\s*\d+/i,
  /\bdisc\s*\d+/i,
  /\bcd\s*\d+/i,
  /\btrack\s*\d+/i,
  /\b\d{1,2}\s*of\s*\d{1,2}\b/i,
  /\b\d{1,2}\/\d{1,2}\b/i,
];
const MIN_BYTES_PER_SECOND = 2000;

export function scoreRelease(
  book: Book,
  release: ReleaseCandidate,
  formats: Format[],
): MatchResult | null {
  if (isComicOrEbook(release.title) || isMultiPartTitle(release.title)) {
    return null;
  }

  if (isReleaseTooSmall(book.runtimeSeconds, release.size)) {
    return null;
  }

  const normalizedBookTitle = normalize(book.title);
  const normalizedReleaseTitle = normalize(release.title);
  const authorScore = computeAuthorScore(book);
  const titleScore = similarity(normalizedBookTitle, normalizedReleaseTitle);
  const asinScore = release.title.toLowerCase().includes(book.audibleAsin.toLowerCase()) ? 0.4 : 0;
  const audioHintScore = hasAudiobookHint(release.title) ? 0.2 : 0;
  const detectedFormat = detectFormat(release.title, formats);
  const formatScore = detectedFormat ? 0.3 + (1 / (detectedFormat.priority + 1)) * 0.1 : 0;

  const totalScore = Number((authorScore + titleScore + asinScore + audioHintScore + formatScore).toFixed(2));

  if (totalScore < 0.35) {
    return null;
  }

  return {
    release,
    score: totalScore,
    detectedFormat,
  };
}

export function isMultiPartTitle(title: string) {
  return MULTIPART_PATTERNS.some((pattern) => pattern.test(title));
}

function isReleaseTooSmall(runtimeSeconds?: number | null, size?: number | null) {
  if (!runtimeSeconds || runtimeSeconds <= 0) {
    return false;
  }
  if (!size || size <= 0) {
    return false;
  }
  return size < runtimeSeconds * MIN_BYTES_PER_SECOND;
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

function detectFormat(title: string, formats: Format[]) {
  return formats.find((format) => {
    const extensions: string[] = JSON.parse(format.extensions ?? "[]");
    return extensions.some((extension) => new RegExp(extension, "i").test(title));
  });
}

function hasAudiobookHint(title: string) {
  return AUDIOBOOK_TERMS.some((regex) => regex.test(title));
}

function isComicOrEbook(title: string) {
  return EBOOK_TERMS.some((regex) => regex.test(title)) || COMIC_TERMS.some((regex) => regex.test(title));
}
