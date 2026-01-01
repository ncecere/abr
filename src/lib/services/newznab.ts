import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { env } from "@/config";
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
  timeoutMs = env.NEWZNAB_REQUEST_TIMEOUT_MS,
): Promise<NewznabItem[]> {
  if (!query.trim()) {
    return [];
  }

  const url = new URL(config.baseUrl);
  const trimmed = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname;
  if (!trimmed.endsWith("/api")) {
    const normalized = trimmed === "/" ? "" : trimmed;
    url.pathname = `${normalized}/api`;
  }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Newznab search failed with ${response.status}`);
      }

      const xml = await response.text();
      const parsed = parser.parse(xml) as Record<string, any>;
      const rawItems = parsed?.rss?.channel?.item ?? [];
      const itemsArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

      return itemsArray.map((item) => normalizeItem(item));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error(`Newznab search timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
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
