import { describe, expect, it } from "vitest";
import { scoreRelease } from "@/lib/matching";
import { Book, Format } from "@/db/schema";

const baseBook = {
  id: 1,
  audibleAsin: "B002V1NYEK",
  audibleProductId: "PROD-1",
  title: "Dune",
  authorsJson: JSON.stringify(["Frank Herbert"]),
  narratorsJson: JSON.stringify(["Scott Brick"]),
  publishYear: 1965,
  description: "A classic",
  releaseDate: "2007-05-01",
  language: "en-us",
  runtimeSeconds: 3600,
  sampleUrl: null,
  coverUrl: null,
  coverPath: null,
  state: "MISSING",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Book;

const formats: Format[] = [
  { id: 1, name: "M4B", extensions: JSON.stringify(["m4b"]), enabled: true, priority: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: "MP3", extensions: JSON.stringify(["mp3"]), enabled: true, priority: 1, createdAt: new Date(), updatedAt: new Date() },
] as unknown as Format[];

describe("scoreRelease", () => {
  it("ignores obvious ebook releases", () => {
    const result = scoreRelease(baseBook, { guid: "1", title: "Dune Retail EPUB", link: "", indexerId: 1 }, formats);
    expect(result).toBeNull();
  });

  it("prefers releases with matching audio format", () => {
    const result = scoreRelease(
      baseBook,
      { guid: "1", title: "Dune (Unabridged) M4B", link: "", indexerId: 1 },
      formats,
    );
    expect(result?.detectedFormat?.name).toBe("M4B");
    expect(result?.score).toBeGreaterThan(0.45);
  });

  it("boosts matches containing the ASIN", () => {
    const result = scoreRelease(
      baseBook,
      { guid: "1", title: "Dune " + baseBook.audibleAsin, link: "", indexerId: 1 },
      formats,
    );
    expect(result?.score).toBeGreaterThan(0.5);
  });
});
