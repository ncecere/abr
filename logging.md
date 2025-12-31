# ABR Wide-Event Logging Spec (based on loggingsucks.com)

## Goal

For every ABR API route or background job, emit **one context-rich structured event** describing what happened to that request/job (“wide event” / “canonical log line”). This replaces dozens of piecemeal `logger.info("starting import")` statements with a single record we can query. ([Logging Sucks][1])

---

## Non-negotiable principles

1. **Log what happened to the request, not what the code is doing.** ([Logging Sucks][1])
2. **Structured logging is required but not sufficient** (JSON/key-value ≠ useful by itself). ([Logging Sucks][1])
3. Optimize for **querying** (high-cardinality + high-dimensionality), not for easy “print strings.” ([Logging Sucks][1])
4. **OpenTelemetry won’t choose context for you**; you must deliberately attach business context. ([Logging Sucks][1])

---

## What to emit: the Wide Event

### Required top-level fields (minimum)

These should exist on every wide event.

* `timestamp` (ISO 8601)
* `request_id` (unique per inbound request; propagated)
* `trace_id` (if you have tracing; otherwise omit)
* `service` (service name)
* `version` (build/version)
* `deployment_id` (optional but recommended)
* `region` (or cluster/zone)
* `method` (HTTP method or RPC method)
* `path` (HTTP path or RPC route)
* `status_code`
* `duration_ms`
* `outcome` (`success` | `error`)

This mirrors the site’s example wide event shape and intent. ([Logging Sucks][1])

### Recommended “context blocks”

Add these as ABR requires (nested objects are fine; keep names consistent across services):

* `user`: `id`, `tier`, whether the user is authenticated (ABR is multi-tenant in the future).
* `feature_flags`: any toggles evaluated for the request.
* `book`: `id`, `asin`, `state`, `authors`, minutes/runtime we touched.
* `download`: SAB/NZBGet metadata – queue id, status, category, output path.
* `indexer`: provider id, base URL, response latency, categories searched.
* `deps`: downstream summaries (Newznab searches, SAB API calls, SQLite queries, cache hits).
* `error`: `type`, `code`, `message`, `retriable`, provider-specific error codes.

### Guardrails

* Do **not** put secrets/credentials/PCI/PHI/raw tokens in the event.
* If you must reference sensitive entities, prefer stable IDs + coarse attributes (tier, segment) over raw PII.

---

## Implementation pattern (request lifecycle builder)

### Pattern summary

1. **Create the wide event at request start** inside the Next.js route handler wrapper.
2. **Store it in AsyncLocalStorage** so service helpers (`addBook`, SAB adapters, etc.) can enrich context without plumbing extra params.
3. **Enrich progressively** as business logic runs (book/download/dependency blocks).
4. **Emit exactly once** in a `finally` just before the response leaves the handler (or after a job finishes). ([Logging Sucks][1])

### Reference pseudocode (ABR/TypeScript)

* `withRouteLogging("books#create")` wraps each HTTP method. It initializes the event using request metadata + env-provided service identifiers.
* `try/catch/finally` sets `status_code`, `outcome`, captures error fields, adds `duration_ms`, then sends one structured JSON line to Pino.
* Background jobs may call `logJobEvent()` once per run with similar fields.

Key requirements for ABR:

* AsyncLocalStorage for request-scoped context.
* Shared `logger.info(event)` that outputs JSON (Pino already configured).
* Enrichment helpers usable from anywhere in the codebase (services/jobs) without checking whether a request is active.

---

## What to stop doing

* Stop writing lots of “narration” logs like `“starting checkout”`, `“calling stripe”`, `“finished checkout”`.
* Stop relying on text search/grep as the primary workflow; wide events are meant to be **queried** by fields. ([Logging Sucks][1])

---

## Sampling plan (cost control)

### Use tail sampling (decision after request completes)

Rules from the site:

1. Keep all errors (500s/exceptions/failures, job crashes, SAB/indexer errors)
2. Keep slow requests (above p99 threshold / `WIDE_LOG_SLOW_REQUEST_MS`)
3. Keep VIP users / future admin/service accounts
4. Random sample the rest (1–5%) ([Logging Sucks][1])

### Implementation requirements

* The sampling decision must run **after** `status_code`, `duration_ms`, and key context (user tier, feature flags) are known.
* If dropped, the event should not be exported/stored.

---

## Canonical field naming (consistency rules)

Define a single canonical schema and enforce it across services:

* IDs: `request_id`, `trace_id`, `user.id`, `cart.id`, `order.id`
* HTTP: `method`, `path`, `status_code`, `duration_ms`
* Outcomes: `outcome = success|error`
* Errors: `error.type`, `error.code`, `error.message`, `error.retriable`

Consistency is what makes cross-service querying work (site’s “47 different ways” to log a user id is the failure mode you’re eliminating). ([Logging Sucks][1])

---

## Instructions for an AI coding agent (copy/paste)

### Deliverables

1. **Shared logging module** (`src/lib/logging/wide-event.ts`) that outputs structured JSON events.
2. **Route wrapper** (`withRouteLogging`) for every `/app/api/**/route.ts` export:

   * initializes `wideEvent`
   * attaches it to AsyncLocalStorage
   * records `duration_ms`
   * captures `status_code`, `outcome`
   * captures normalized `error` fields
   * emits exactly once
3. **Enrichment helpers** usable from services/jobs:

   * user context
   * feature flags
   * ABR domain objects (book, download, indexer)
   * dependency summaries (db/cache/external calls)
4. **Tail sampling hook** (configurable thresholds + sampling rate) applied at emit-time.
5. **Job runner instrumentation** that emits one wide event per background job execution with the same schema.

### Acceptance criteria (tests)

* For a single request, exactly **one** wide event is emitted per service instance handling it. ([Logging Sucks][1])
* Event includes `request_id`, `service`, `method/path`, `status_code`, `duration_ms`. ([Logging Sucks][1])
* On exceptions, event includes `outcome=error` and `error.{type,message,code,retriable}` (where available). ([Logging Sucks][1])
* Book/download/indexer context shows up when the request touched those rows (e.g., `book.id`, `download.status`).
* Background jobs emit exactly one event each time a handler runs, including duration/outcome/error.
* Tail sampling:

  * 100% of errors retained
  * slow requests retained above threshold
  * VIP/flagged cohorts retained
  * otherwise sampled at configured rate ([Logging Sucks][1])
* Field names are consistent across all services (no `userId` vs `user_id` drift). ([Logging Sucks][1])

### Config knobs (env or config file)

* `SERVICE_NAME`, `SERVICE_VERSION`, `DEPLOYMENT_ID`, `REGION`
* `LOG_LEVEL` (but wide event should generally be emitted at info-level as the canonical record)
* Tail sampling:

  * `SLOW_REQUEST_MS` (p99 threshold proxy)
  * `RANDOM_SAMPLE_RATE` (0.01–0.05 typical)
  * `VIP_TIER` values or predicate
  * `ALWAYS_KEEP_FLAGS` (list of feature flags that force retention)

---

## Minimal JSON schema (starter)

Use this as your baseline contract.

```json
{
  "timestamp": "string (iso8601)",
  "request_id": "string",
  "trace_id": "string (optional)",
  "service": "string",
  "version": "string",
  "deployment_id": "string (optional)",
  "region": "string (optional)",

  "method": "string",
  "path": "string",
  "status_code": "number",
  "duration_ms": "number",
  "outcome": "success|error",

  "user": { "id": "string", "subscription": "string (optional)" },
  "feature_flags": { "flag_name": "boolean" },

  "error": {
    "type": "string",
    "code": "string (optional)",
    "message": "string (optional)",
    "retriable": "boolean (optional)"
  }
}
```

---

If you tell me your stack (language + web framework + logging backend), I can translate this into an exact implementation recipe (modules/files, middleware placement, and concrete library choices) while keeping the wide-event approach unchanged.

[1]: https://loggingsucks.com/ "Logging Sucks - Your Logs Are Lying To You"
