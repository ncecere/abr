import { describe, expect, it } from "vitest";
import { normalizeProduct } from "@/lib/services/audible";

describe("Audible normalization", () => {
  it("collects contributors, runtime, and release info", () => {
    const normalized = normalizeProduct({
      asin: "B002V1NYEK",
      product_id: "PROD-1",
      title: "Dune",
      authors: [{ name: "Frank Herbert" }],
      narrators: [{ name: "Scott Brick" }],
      release_date: "2007-05-01",
      runtime_length_min: 1234,
      publisher_summary: "<p>An epic saga</p>",
      language: "en-us",
      product_images: {
        "500": { url: "https://example.com/cover.jpg" },
      },
      sample_url: "https://example.com/sample.mp3",
    });

    expect(normalized.asin).toBe("B002V1NYEK");
    expect(normalized.productId).toBe("PROD-1");
    expect(normalized.authors).toEqual(["Frank Herbert"]);
    expect(normalized.narrators).toEqual(["Scott Brick"]);
    expect(normalized.publishYear).toBe(2007);
    expect(normalized.runtimeSeconds).toBe(1234 * 60);
    expect(normalized.description).toBe("An epic saga");
    expect(normalized.coverUrl).toBe("https://example.com/cover.jpg");
    expect(normalized.sampleUrl).toBe("https://example.com/sample.mp3");
  });
});
