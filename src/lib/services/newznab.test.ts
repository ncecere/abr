import { describe, expect, it } from "vitest";
import { normalizeItem } from "@/lib/services/newznab";

describe("normalizeItem", () => {
  it("pulls guid and metadata from nested XML structure", () => {
    const result = normalizeItem({
      guid: { "#text": "GUID123" },
      title: "Dune.2020.EPUB",
      link: "https://example/nzb",
      enclosure: { length: "12345" },
      pubDate: "Tue, 01 Jan 2024 10:00:00 +0000",
      "newznab:attr": [{ name: "category", value: "7020" }],
    });
    expect(result.guid).toBe("GUID123");
    expect(result.size).toBe(12345);
    expect(result.category).toBe(7020);
  });
});
