# Plan: Filter Multi-Part Releases Upstream

## Goals
- Keep the library single-file per title by refusing multi-part releases before they reach the importer.
- Improve release selection heuristics so SAB/NZBGet only downloads candidates that are likely complete `.m4b`/single-container files.
- Preserve future flexibility (e.g., optional multi-file import) by isolating the logic in matching/search layers.
- Harden release searches so a single failing indexer does not blank the results.

## Steps
1. **Query shaping**
   - Update `buildSearchQueries` to produce strict queries first (e.g., include format hints + `-part -disc -cd`).
   - Iterate strict → relaxed queries in `fetchReleasesAcrossIndexers`, stopping as soon as a query yields results.

2. **Title filtering / scoring**
   - Extend `scoreRelease` with `isMultiPartTitle(title)` that detects `part|disc|cd|track` tokens + ordinal numbers.
   - If matched, return `null` (hard reject) or apply a heavy score penalty so multi-part uploads never win automatically.
   - Optionally, use runtime-derived minimum size to reject tiny “track” uploads.

3. **Importer safety net**
   - Keep importer guardrails ready (future work) to detect multi-file directories, log a clear error, and requeue searches.
   - When multiple matching files are detected, discard the release, mark the book back to `MISSING`, and enqueue `SEARCH_BOOK` so the automation loop keeps hunting.

4. **Indexer resilience**
   - Wrap each `queryNewznab` call in `fetchReleasesAcrossIndexers` with `try/catch` so timeouts/5xx from one indexer don’t abort the whole search.
   - Log failures per indexer and continue iterating; report aggregate failures to the UI when all indexers fail.
   - Consider per-indexer timeouts (AbortController) to avoid hangs.
   - Run indexer calls in parallel with a capped concurrency limiter so searches complete quickly even with 5–6 providers.

5. **Release dedupe & heuristics**
   - Before inserting into `releases`, enforce a `(bookId, guid)` uniqueness check and skip duplicates that are already downloading or failed.
   - Compare expected runtime-derived sizes to the NZB-reported size to avoid obviously incomplete “chapter dumps”.

6. **Job queue hardening**
   - Claim jobs atomically with a single `UPDATE ... WHERE status='queued' ... RETURNING *` pattern to prevent duplicate processing when multiple runners exist.
   - Persist `lastError` history to surface stuck jobs in the UI/activity feed.

7. **Observability & UI signals**
   - Pipe key wide-event data (indexer failures, importer rejections) into user-facing logs or UI badges so operators understand why a title stalled.

8. **Tests & docs**
   - Add matcher tests covering positive/negative multi-part patterns.
   - Add service tests ensuring failed indexers are skipped while others still contribute results.
   - Add queue/importer tests for duplicate job claims and multi-file rejection.
   - Update README/Docs to mention that ABR prefers single-file releases and skips multi-part uploads by design.
