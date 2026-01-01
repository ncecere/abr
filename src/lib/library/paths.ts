import path from "node:path";
import slugify from "@sindresorhus/slugify";

export function sanitizeSegment(value: string) {
  return slugify(value || "unknown", { separator: "-" });
}

export function getBookDirectory(authors: string[], title: string, libraryRoot: string) {
  const primaryAuthor = authors[0] ?? "unknown-author";
  const authorFolder = sanitizeSegment(primaryAuthor);
  const titleFolder = sanitizeSegment(title);
  return path.join(libraryRoot, "audiobook", authorFolder, titleFolder);
}

export function getMergedFileName(authors: string[], title: string, extension: string) {
  const primaryAuthor = sanitizeSegment(authors[0] ?? "unknown-author");
  const titleSegment = sanitizeSegment(title);
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  return `${titleSegment}-${primaryAuthor}.${ext}`;
}
