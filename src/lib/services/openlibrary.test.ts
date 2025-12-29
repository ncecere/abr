import { describe, expect, it } from "vitest";
import { normalizeSearchDoc, normalizeWork } from "@/lib/services/openlibrary";

describe("Open Library normalization", () => {
  it("strips work prefix from search docs", () => {
    const normalized = normalizeSearchDoc({
      key: "/works/OL123W",
      title: "Neuromancer",
      author_name: ["William Gibson"],
    });
    expect(normalized.workId).toBe("OL123W");
    expect(normalized.authors).toEqual(["William Gibson"]);
  });

  it("extracts cover ids and description from work payloads", () => {
    const work = {
      key: "/works/OL123W",
      title: "Neuromancer",
      description: { value: "Sprawl trilogy" },
      covers: [100],
    };
    const normalized = normalizeWork(work, undefined);
    expect(normalized.coverUrl).toContain("100-L.jpg");
    expect(normalized.description).toBe("Sprawl trilogy");
  });
});
