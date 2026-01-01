import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Book } from "@/db/schema";
import { buildSearchQueries, fetchReleasesAcrossIndexers } from "@/lib/services/release-search";
import type { IndexerRecord } from "@/lib/services/release-search";
import { queryNewznab } from "@/lib/services/newznab";

vi.mock("@/lib/services/newznab", () => ({
  queryNewznab: vi.fn(),
}));

const queryNewznabMock = queryNewznab as unknown as ReturnType<typeof vi.fn>;

const baseBook = {
  id: 1,
  audibleAsin: "B002V1NYEK",
  audibleProductId: "PROD-1",
  title: "Dune",
  authorsJson: JSON.stringify(["Frank Herbert"]),
  narratorsJson: JSON.stringify(["Narrator"]),
  publishYear: 1965,
  releaseDate: "2007-05-01",
  description: "",
  language: "en",
  runtimeSeconds: 3600,
  state: "MISSING",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Book;

const baseIndexer = {
  id: 10,
  name: "TestIndexer",
  baseUrl: "https://example.com/api",
  apiKey: "abc",
  categories: JSON.stringify([3030]),
  enabled: true,
  priority: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IndexerRecord;

describe("buildSearchQueries", () => {
  it("produces strict queries with negative keywords first", () => {
    const plan = buildSearchQueries(baseBook);
    expect(plan.strict.length).toBeGreaterThan(0);
    expect(plan.strict[0]).toMatch(/m4b/i);
    expect(plan.strict[0]).toContain("-part");
    expect(plan.relaxed).not.toContain(plan.strict[0]);
  });
});

describe("fetchReleasesAcrossIndexers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryNewznabMock.mockReset();
  });

  it("stops after the first strict query returns releases", async () => {
    queryNewznabMock.mockResolvedValueOnce([
      { guid: "guid", title: "Dune", link: "https://example.com" },
    ]);

    const { releases } = await fetchReleasesAcrossIndexers(baseBook, [baseIndexer], 5);
    expect(releases).toHaveLength(1);
    expect(queryNewznabMock).toHaveBeenCalledTimes(1);
  });

  it("records failures when an indexer throws", async () => {
    queryNewznabMock.mockRejectedValueOnce(new Error("boom"));

    const { releases, failures } = await fetchReleasesAcrossIndexers(baseBook, [baseIndexer], 5);
    expect(releases).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toContain("boom");
  });
});
