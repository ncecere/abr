import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { queryNewznab } from "@/lib/services/newznab";

const DEFAULT_AUDIOBOOK_CATEGORIES = [3030, 3035, 3036, 3040];

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (!payload?.baseUrl || !payload?.apiKey) {
      return problem(400, "Missing base URL or API key");
    }

    const categories = normalizeCategories(payload.categories);
    await queryNewznab(
      {
        baseUrl: payload.baseUrl,
        apiKey: payload.apiKey,
        categories,
      },
      payload?.query ?? "audiobook",
      1,
    );

    return success({ ok: true });
  } catch (error) {
    return problem(400, "Indexer test failed", error instanceof Error ? error.message : String(error));
  }
}

function normalizeCategories(value: unknown) {
  const fromInput: number[] = Array.isArray(value)
    ? value.map((entry) => Number(entry))
    : typeof value === "string"
    ? value
        .split(",")
        .map((entry) => Number(entry.trim()))
    : [];

  const valid = fromInput.filter((entry) => !Number.isNaN(entry) && entry > 0);
  return Array.from(new Set([...DEFAULT_AUDIOBOOK_CATEGORIES, ...valid]));
}
