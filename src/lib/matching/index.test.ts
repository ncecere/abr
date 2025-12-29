import { describe, expect, it } from "vitest";
import { scoreRelease } from "@/lib/matching";
import { Book, Format } from "@/db/schema";

const baseBook = {
  id: 1,
  openLibraryWorkId: "OL123W",
  openLibraryEditionId: "OL456M",
  title: "Dune",
  authorsJson: JSON.stringify(["Frank Herbert"]),
  publishYear: 1965,
  description: "A classic",
  isbn10: "1234567890",
  isbn13: "9781234567897",
  coverUrl: null,
  state: "MISSING",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Book;

const formats: Format[] = [
  { id: 1, name: "EPUB", extensions: JSON.stringify(["epub"]), enabled: true, priority: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: "PDF", extensions: JSON.stringify(["pdf"]), enabled: true, priority: 1, createdAt: new Date(), updatedAt: new Date() },
] as unknown as Format[];

describe("scoreRelease", () => {
  it("returns null for audiobook releases", () => {
    const result = scoreRelease(baseBook, { guid: "1", title: "Dune Audiobook", link: "", indexerId: 1 }, formats);
    expect(result).toBeNull();
  });

  it("prefers releases with matching format", () => {
    const result = scoreRelease(
      baseBook,
      { guid: "1", title: "Dune 1965 Retail EPUB", link: "", indexerId: 1 },
      formats,
    );
    expect(result?.detectedFormat?.name).toBe("EPUB");
    expect(result?.score).toBeGreaterThan(0.45);
  });

  it("rewards ISBN matches", () => {
    const result = scoreRelease(
      baseBook,
      { guid: "1", title: "Dune 9781234567897", link: "", indexerId: 1 },
      formats,
    );
    expect(result?.score).toBeGreaterThan(0.5);
  });
});
