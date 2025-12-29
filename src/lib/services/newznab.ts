import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { RateLimiter } from "@/lib/services/rate-limiter";

export type NewznabItem = {
  guid: string;
  title: string;
  link: string;
  size?: number;
  category?: number;
  publishedAt?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const indexerLimiter = new RateLimiter(2, 1000);

export async function queryNewznab(
  config: {
    baseUrl: string;
    apiKey: string;
    categories: number[];
  },
  query: string,
  limit = 50,
): Promise<NewznabItem[]> {
  if (!query.trim()) {
    return [];
  }

  const url = new URL(config.baseUrl);
  url.pathname = "/api";
  url.searchParams.set("t", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("apikey", config.apiKey);
  url.searchParams.set("extended", "1");
  url.searchParams.set("o", "xml");
  url.searchParams.set("limit", String(limit));
  if (config.categories.length) {
    url.searchParams.set("cat", config.categories.join(","));
  }

  return indexerLimiter.schedule(async () => {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Newznab search failed with ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parser.parse(xml) as Record<string, any>;
    const rawItems = parsed?.rss?.channel?.item ?? [];
    const itemsArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return itemsArray.map((item) => normalizeItem(item));
  });
}

export function normalizeItem(item: Record<string, unknown>): NewznabItem {
  const enclosure = item.enclosure as { length?: string } | undefined;
  const attr = item["newznab:attr"] as
    | { name?: string; value?: string }[]
    | undefined;
  const size = enclosure?.length ? Number(enclosure.length) : undefined;
  const categoryAttr = attr?.find((entry) => entry.name === "category");

  let guid: string | undefined;
  if (typeof item.guid === "string") {
    guid = item.guid;
  } else if (
    typeof item.guid === "object" &&
    item.guid !== null &&
    typeof (item.guid as Record<string, unknown>)["#text"] === "string"
  ) {
    guid = String((item.guid as Record<string, unknown>)["#text"]);
  }

  return {
    guid: guid ?? crypto.randomUUID(),
    title: String(item.title ?? ""),
    link: String(item.link ?? ""),
    size,
    category: categoryAttr?.value ? Number(categoryAttr.value) : undefined,
    publishedAt: typeof item.pubDate === "string" ? item.pubDate : undefined,
  };
}
