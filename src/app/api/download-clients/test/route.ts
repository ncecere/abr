import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import { success, problem } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const POST = withRouteLogging("downloadClients#test", async (request: NextRequest) => {
  try {
    const payload = await request.json();
    if (!payload?.type || !payload?.host || !payload?.port) {
      return problem(400, "Missing required fields");
    }

    if (payload.type === "sabnzbd") {
      await testSabnzbd(payload);
    } else if (payload.type === "nzbget") {
      await testNzbget(payload);
    } else {
      return problem(400, "Unknown download client type");
    }

    return success({ ok: true });
  } catch (error) {
    return problem(400, "Download client test failed", error instanceof Error ? error.message : String(error));
  }
});

async function testSabnzbd(config: any) {
  const baseUrl = normalizeHost(config.host, config.port, true);
  const url = new URL("/api", baseUrl);
  url.searchParams.set("mode", "queue");
  url.searchParams.set("start", "0");
  url.searchParams.set("limit", "1");
  url.searchParams.set("output", "json");
  if (config.apiKey) {
    url.searchParams.set("apikey", config.apiKey);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SABnzbd responded with ${response.status}`);
  }
  await response.json();
}

async function testNzbget(config: any) {
  const baseUrl = normalizeHost(config.host, config.port, false);
  const url = new URL("/jsonrpc", baseUrl);
  const credentials = config.username && config.password
    ? `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`
    : undefined;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(credentials ? { Authorization: credentials } : {}),
    },
    body: JSON.stringify({ method: "status", params: [], id: Math.random().toString(36).slice(2) }),
  });
  if (!response.ok) {
    throw new Error(`NZBGet responded with ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(payload.error?.message ?? "NZBGet returned an error");
  }
}

function normalizeHost(host: string, port: number, ensureApiPath: boolean) {
  const hasProtocol = host.startsWith("http://") || host.startsWith("https://");
  const url = new URL(hasProtocol ? host : `http://${host}`);
  url.port = String(port);
  if (ensureApiPath && url.pathname === "/") {
    url.pathname = "/";
  }
  return url.toString();
}
