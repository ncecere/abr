import { env } from "@/config";
import { logger } from "@/lib/logger";
import { RateLimiter } from "@/lib/services/rate-limiter";

const limiter = new RateLimiter(5, 1000);

const REGION_SUFFIXES: Record<string, string> = {
  us: ".com",
  ca: ".ca",
  uk: ".co.uk",
  au: ".com.au",
  fr: ".fr",
  de: ".de",
  jp: ".co.jp",
  it: ".it",
  in: ".in",
  es: ".es",
  br: ".com.br",
};

const PUBLIC_RESPONSE_GROUPS = "product_desc,contributors,media,product_attrs,product_extended_attrs";
const AUDNEXUS_BASE = "https://api.audnex.us";
const AUDIMETA_BASE = "https://audimeta.de";

export type AudibleContributor = {
  name?: string;
  role?: string;
};

export type AudibleImageSet = Record<string, { url?: string } | undefined>;

export type AudibleProduct = {
  asin: string;
  product_id?: string;
  title: string;
  authors?: AudibleContributor[];
  narrators?: AudibleContributor[];
  contributors?: AudibleContributor[];
  publisher_summary?: string;
  description?: string;
  short_description?: string;
  release_date?: string;
  publication_date?: string;
  language?: string;
  language_locale?: string;
  runtime_length_min?: number;
  runtime_length_sec?: number;
  runtime_length_ms?: number;
  product_images?: AudibleImageSet;
  images?: AudibleImageSet;
  sample_url?: string;
  samples?: { url?: string }[];
  media?: {
    length_in_minutes?: number;
    length_in_seconds?: number;
    length_in_ms?: number;
    samples?: { url?: string }[];
  };
};

export type AudibleSearchResponse = {
  products?: AudibleProduct[];
};

export type AudibleProductResponse = {
  product?: AudibleProduct;
};

export type NormalizedAudiobook = {
  asin: string;
  productId?: string;
  title: string;
  authors: string[];
  narrators: string[];
  publishYear?: number;
  releaseDate?: string;
  description?: string;
  language?: string;
  runtimeSeconds?: number;
  coverUrl?: string;
  sampleUrl?: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function searchAudiobooks(query: string) {
  if (!query.trim()) {
    return [];
  }

  const url = buildRegionalUrl("/1.0/catalog/products", {
    keywords: query,
    num_results: "20",
    products_sort_by: "Relevance",
    response_groups: PUBLIC_RESPONSE_GROUPS,
  });

  const data = await limiter.schedule(() => fetchJson<AudibleSearchResponse>(url));
  return (data.products ?? []).map(normalizeProduct);
}

export async function getAudiobook(asin: string) {
  const official = await tryOfficialProductLookup(asin);
  if (official) {
    return official;
  }

  const audnexus = await fetchAudnexusBook(asin);
  if (audnexus) {
    return audnexus;
  }

  const audimeta = await fetchAudimetaBook(asin);
  if (audimeta) {
    return audimeta;
  }

  const fallback = await fetchCatalogFallback(asin);
  if (fallback) {
    return fallback;
  }

  throw new Error(`Unable to retrieve audiobook ${asin}`);
}

export function normalizeProduct(product: AudibleProduct): NormalizedAudiobook {
  const authors = dedupeNames(resolveContributors(product, "author"));
  const narrators = dedupeNames(resolveContributors(product, "narrator"));
  const releaseDate = product.release_date ?? product.publication_date;
  const publishYear = parseYear(releaseDate);
  const runtimeSeconds = resolveRuntimeSeconds(product);
  const description = sanitizeDescription(
    product.publisher_summary,
    product.description,
    product.short_description,
  );
  const language = product.language_locale ?? product.language ?? undefined;
  const coverUrl = pickCoverUrl(product.product_images ?? product.images);
  const sampleUrl = resolveSampleUrl(product);

  return {
    asin: product.asin,
    productId: product.product_id,
    title: product.title,
    authors: authors.length ? authors : ["Unknown"],
    narrators,
    publishYear,
    releaseDate,
    description,
    language,
    runtimeSeconds,
    coverUrl,
    sampleUrl,
  };
}

function resolveRegionSuffix() {
  const region = env.AUDIBLE_REGION?.toLowerCase?.() ?? "us";
  return REGION_SUFFIXES[region] ?? ".com";
}

function buildRegionalUrl(path: string, params: Record<string, string> = {}) {
  const base = env.AUDIBLE_API_BASE_URL || `https://api.audible${resolveRegionSuffix()}`;
  const url = new URL(path, base);
  if (Object.keys(params).length) {
    url.search = new URLSearchParams(params).toString();
  }
  return url;
}

async function fetchJson<T>(url: URL, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    throw new Error(`Audible request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function tryOfficialProductLookup(asin: string): Promise<NormalizedAudiobook | null> {
  if (!hasCredentials()) {
    return null;
  }
  try {
    const url = new URL(`/1.0/catalog/products/${asin}`, env.AUDIBLE_API_BASE_URL);
    const params = new URLSearchParams({
      marketplace: env.AUDIBLE_MARKETPLACE,
      locale: env.AUDIBLE_LOCALE,
      response_groups: PUBLIC_RESPONSE_GROUPS,
    });
    url.search = params.toString();
    const data = await limiter.schedule(() => audibleFetch<AudibleProductResponse>(url));
    if (data.product) {
      return normalizeProduct(data.product);
    }
  } catch (error) {
    logger.warn({ asin, error }, "failed official Audible lookup, falling back to public endpoints");
  }
  return null;
}

async function fetchCatalogFallback(asin: string): Promise<NormalizedAudiobook | null> {
  try {
    const url = buildRegionalUrl("/1.0/catalog/products", {
      keywords: asin,
      num_results: "1",
      response_groups: PUBLIC_RESPONSE_GROUPS,
    });
    const data = await limiter.schedule(() => fetchJson<AudibleSearchResponse>(url));
    const product = data.products?.find((entry) => entry.asin === asin) ?? data.products?.[0];
    return product ? normalizeProduct(product) : null;
  } catch (error) {
    logger.warn({ asin, error }, "catalog fallback lookup failed");
    return null;
  }
}

async function fetchAudnexusBook(asin: string): Promise<NormalizedAudiobook | null> {
  try {
    const url = new URL(`/books/${asin}`, AUDNEXUS_BASE);
    url.searchParams.set("region", env.AUDIBLE_REGION?.toLowerCase?.() ?? "us");
    const data = await fetchJson<any>(url, { headers: { "Client-Agent": "ebr" } });
    return normalizeAudnexus(data);
  } catch (error) {
    logger.debug({ asin, error }, "audnexus lookup failed");
    return null;
  }
}

async function fetchAudimetaBook(asin: string): Promise<NormalizedAudiobook | null> {
  try {
    const url = new URL(`/book/${asin}`, AUDIMETA_BASE);
    url.searchParams.set("region", env.AUDIBLE_REGION?.toLowerCase?.() ?? "us");
    const data = await fetchJson<any>(url, { headers: { "Client-Agent": "ebr" } });
    return normalizeAudimeta(data);
  } catch (error) {
    logger.debug({ asin, error }, "audimeta lookup failed");
    return null;
  }
}

function normalizeAudnexus(payload: any): NormalizedAudiobook | null {
  if (!payload?.asin) {
    return null;
  }
  const authors = (payload.authors ?? []).map((entry: any) => entry?.name).filter(Boolean);
  const narrators = (payload.narrators ?? []).map((entry: any) => entry?.name).filter(Boolean);
  const releaseDate = payload.releaseDate ?? payload.release_date ?? undefined;
  const publishYear = parseYear(releaseDate);
  const runtimeSeconds = payload.runtimeLengthMin ? Math.round(payload.runtimeLengthMin * 60) : undefined;
  return {
    asin: payload.asin,
    productId: payload.asin,
    title: payload.title ?? payload.asin,
    authors: authors.length ? authors : ["Unknown"],
    narrators,
    publishYear,
    releaseDate,
    description: sanitizeDescription(payload.subtitle, payload.description),
    language: payload.language,
    runtimeSeconds,
    coverUrl: payload.image,
    sampleUrl: payload.sampleUrl,
  };
}

function normalizeAudimeta(payload: any): NormalizedAudiobook | null {
  if (!payload?.asin) {
    return null;
  }
  const authors = (payload.authors ?? []).map((entry: any) => entry?.name).filter(Boolean);
  const narrators = (payload.narrators ?? []).map((entry: any) => entry?.name).filter(Boolean);
  const runtimeSeconds = payload.lengthMinutes ? Math.round(payload.lengthMinutes * 60) : undefined;
  const releaseDate = payload.releaseDate ?? undefined;
  return {
    asin: payload.asin,
    productId: payload.asin,
    title: payload.title ?? payload.asin,
    authors: authors.length ? authors : ["Unknown"],
    narrators,
    publishYear: parseYear(releaseDate),
    releaseDate,
    description: sanitizeDescription(payload.subtitle, payload.description),
    language: payload.language,
    runtimeSeconds,
    coverUrl: payload.imageUrl,
    sampleUrl: payload.sampleUrl,
  };
}

function hasCredentials() {
  return Boolean(env.AUDIBLE_CLIENT_ID && env.AUDIBLE_CLIENT_SECRET);
}

async function audibleFetch<T>(url: URL, retry = true): Promise<T> {
  if (!hasCredentials()) {
    throw new Error("Audible credentials are missing");
  }

  const token = await getAccessToken();
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && retry) {
    tokenCache = null;
    return audibleFetch<T>(url, false);
  }

  if (!response.ok) {
    throw new Error(`Audible request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  if (!hasCredentials()) {
    throw new Error("Audible credentials are missing");
  }

  const credentials = Buffer.from(`${env.AUDIBLE_CLIENT_ID}:${env.AUDIBLE_CLIENT_SECRET}`).toString(
    "base64",
  );
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "catalog:read",
  });

  const response = await fetch(env.AUDIBLE_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Audible token: ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Audible token response missing access_token");
  }

  const expiresInMs = Math.max(30, (payload.expires_in ?? 3600) - 60) * 1000;
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  return payload.access_token;
}

function resolveContributors(product: AudibleProduct, role: "author" | "narrator") {
  const direct = role === "author" ? product.authors : product.narrators;
  const fromContributors = (product.contributors ?? []).filter((entry) =>
    entry.role ? entry.role.toLowerCase().includes(role) : false,
  );
  return [...(direct ?? []), ...fromContributors];
}

function dedupeNames(contributors: AudibleContributor[]) {
  const names = contributors
    .map((entry) => entry.name?.trim())
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}

function parseYear(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(\d{4})/);
  if (!match) return undefined;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : undefined;
}

function resolveRuntimeSeconds(product: AudibleProduct) {
  if (typeof product.runtime_length_sec === "number") {
    return Math.round(product.runtime_length_sec);
  }
  if (typeof product.runtime_length_min === "number") {
    return Math.round(product.runtime_length_min * 60);
  }
  if (typeof product.runtime_length_ms === "number") {
    return Math.round(product.runtime_length_ms / 1000);
  }
  if (typeof product.media?.length_in_seconds === "number") {
    return Math.round(product.media.length_in_seconds);
  }
  if (typeof product.media?.length_in_minutes === "number") {
    return Math.round(product.media.length_in_minutes * 60);
  }
  if (typeof product.media?.length_in_ms === "number") {
    return Math.round(product.media.length_in_ms / 1000);
  }
  return undefined;
}

function pickCoverUrl(images?: AudibleImageSet) {
  if (!images) return undefined;
  const preferredOrder = ["1210", "1000", "900", "700", "500", "300"];
  for (const key of preferredOrder) {
    const candidate = images[key]?.url;
    if (candidate) {
      return candidate;
    }
  }
  const fallback = Object.values(images).find((entry) => entry?.url)?.url;
  return fallback;
}

function resolveSampleUrl(product: AudibleProduct) {
  if (product.sample_url) {
    return product.sample_url;
  }
  const fromSamples = product.samples?.find((entry) => entry.url)?.url;
  if (fromSamples) {
    return fromSamples;
  }
  const mediaSample = product.media?.samples?.find((entry) => entry.url)?.url;
  return mediaSample;
}

function sanitizeDescription(...values: (string | undefined)[]) {
  for (const value of values) {
    if (!value) continue;
    const stripped = stripHtml(value);
    if (stripped) {
      return stripped;
    }
  }
  return undefined;
}

function stripHtml(value: string) {
  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol)>/gi, "\n")
    .replace(/<(p|div|li|ul|ol)[^>]*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  const withoutEntities = withoutTags.replace(/&nbsp;/gi, " ");
  const collapsed = withoutEntities.replace(/\n{3,}/g, "\n\n").trim();
  return collapsed;
}
