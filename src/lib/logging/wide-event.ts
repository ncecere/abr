import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Job } from "@/db/schema";
import { env } from "@/config";
import { logger } from "@/lib/logger";

export type WideEvent = {
  timestamp: string;
  request_id: string;
  trace_id?: string;
  service: string;
  version: string;
  deployment_id?: string;
  region?: string;
  method: string;
  path: string;
  route: string;
  query?: Record<string, string | string[]>;
  status_code: number;
  duration_ms: number;
  outcome: "success" | "error";
  error?: {
    type: string;
    message?: string;
    code?: string | number;
    retriable?: boolean;
  };
  user?: Record<string, unknown>;
  feature_flags?: Record<string, boolean>;
  book?: Record<string, unknown>;
  download?: Record<string, unknown>;
  deps?: Record<string, unknown>;
  job?: Record<string, unknown>;
};

type WideEventState = {
  event: WideEvent;
  startAt: [number, number];
  finished: boolean;
};

type RouteHandler<Context> = (request: NextRequest, context: Context) => Promise<Response> | Response;

const storage = new AsyncLocalStorage<WideEventState>();

export function withRouteLogging<Context = { params?: unknown }>(
  routeName: string,
  handler: RouteHandler<Context>,
): RouteHandler<Context> {
  return async (request, context) => {
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
    const traceId = request.headers.get("x-trace-id") ?? request.headers.get("traceparent") ?? undefined;
    const baseEvent: WideEvent = {
      timestamp: new Date().toISOString(),
      request_id: requestId,
      trace_id: traceId,
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      deployment_id: env.DEPLOYMENT_ID,
      region: env.REGION,
      method: request.method,
      path: request.nextUrl.pathname,
      route: routeName,
      query: collectQueryParams(request),
      status_code: 0,
      duration_ms: 0,
      outcome: "success",
    };

    const state: WideEventState = {
      event: baseEvent,
      startAt: process.hrtime(),
      finished: false,
    };

    const abortListener = () => {
      if (state.finished) return;
      logger.warn({ requestId }, "request aborted by client");
      finalizeWideEvent(state, 499, new Error("Client aborted"));
    };
    request.signal.addEventListener("abort", abortListener);

    return storage.run(state, async () => {
      try {
        const response = await handler(request, context);
        finalizeWideEvent(state, response.status ?? 200);
        response.headers.set("x-request-id", requestId);
        return response;
      } catch (error) {
        finalizeWideEvent(state, 500, error as Error);
        throw error;
      } finally {
        request.signal.removeEventListener("abort", abortListener);
      }
    });
  };
}

export function addWideEventContext(block: keyof Pick<WideEvent, "user" | "feature_flags" | "book" | "download" | "deps" | "job">, data: Record<string, unknown>) {
  const store = storage.getStore();
  if (!store) return;
  const current = (store.event[block] as Record<string, unknown> | undefined) ?? {};
  store.event[block] = { ...current, ...data } as any;
}

export function setUserContext(user: { id?: string | number; tier?: string; subscription?: string }) {
  addWideEventContext("user", user);
}

export function setFeatureFlagContext(flags: Record<string, boolean>) {
  addWideEventContext("feature_flags", flags);
}

export function setBookContext(details: { id?: number; asin?: string; state?: string }) {
  addWideEventContext("book", details);
}

export function setDownloadContext(details: { id?: number; external_id?: string; status?: string }) {
  addWideEventContext("download", details);
}

export function setDependencySummary(details: Record<string, unknown>) {
  addWideEventContext("deps", details);
}

export function getCurrentRequestId() {
  return storage.getStore()?.event.request_id;
}

function finalizeWideEvent(state: WideEventState, statusCode: number, error?: Error) {
  if (state.finished) return;
  state.finished = true;
  const diff = process.hrtime(state.startAt);
  const durationMs = diff[0] * 1000 + diff[1] / 1_000_000;

  state.event.status_code = statusCode;
  state.event.duration_ms = durationMs;
  state.event.outcome = statusCode >= 400 || error ? "error" : "success";

  if (error) {
    state.event.error = {
      type: error.name ?? "Error",
      message: error.message,
      code: (error as any).code,
      retriable: false,
    };
  }

  if (!shouldEmit(state.event)) {
    return;
  }

  logger.info(state.event, "http.request");
}

export function logJobEvent(details: { job: Job; durationMs: number; outcome: "success" | "error"; error?: Error | string }) {
  const payload = safeParsePayload(details.job.payload);

  const event: WideEvent = {
    timestamp: new Date().toISOString(),
    request_id: randomUUID(),
    service: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
    deployment_id: env.DEPLOYMENT_ID,
    region: env.REGION,
    method: "JOB",
    path: `/jobs/${details.job.type}`,
    route: details.job.type,
    status_code: details.outcome === "error" ? 500 : 204,
    duration_ms: details.durationMs,
    outcome: details.outcome,
    job: {
      id: details.job.id,
      type: details.job.type,
      payload,
    },
  };

  if (details.error) {
    const normalizedError =
      details.error instanceof Error ? details.error : new Error(typeof details.error === "string" ? details.error : String(details.error));
    event.error = {
      type: normalizedError.name ?? "Error",
      message: normalizedError.message,
    };
  }

  if (!shouldEmit(event)) {
    return;
  }

  logger.info(event, "job.event");
}

function shouldEmit(event: WideEvent) {
  if (event.outcome === "error" || event.status_code >= 500) {
    return true;
  }
  if (event.duration_ms >= env.WIDE_LOG_SLOW_REQUEST_MS) {
    return true;
  }
  return Math.random() <= env.WIDE_LOG_SAMPLE_RATE;
}

function safeParsePayload(payload?: string | null) {
  if (!payload) return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function collectQueryParams(request: NextRequest): Record<string, string | string[]> | undefined {
  if (request.nextUrl.searchParams.size === 0) {
    return undefined;
  }
  const entries: Record<string, string | string[]> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (entries[key]) {
      const existing = entries[key];
      entries[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      entries[key] = value;
    }
  }
  return entries;
}
