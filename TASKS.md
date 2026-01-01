# Tasks

- [x] Audit current `buildSearchQueries` usage and list which “strict” tokens (format names, `-part/-disc`, runtime hints) should appear in the first wave of queries.
- [x] Implement reordered query generation plus strict→relaxed iteration in `fetchReleasesAcrossIndexers`, ensuring we short-circuit once releases are returned.
- [x] Add unit coverage for the new query ordering so regressions are caught (`release-search.test.ts`).
- [x] Design an `isMultiPartTitle` helper that captures `part|disc|cd|track` patterns as well as `01of10`/`1-10` style numbering.
- [x] Integrate the helper into `scoreRelease` with either a hard reject or steep penalty, and verify format detection still works for clean titles.
- [x] Add sanity logic comparing runtime (if known) to NZB `size`, flagging releases that look too small to hold the full book.
- [x] Update/extend matcher tests to cover multi-part rejection, runtime-vs-size heuristics, and happy-path scoring boosts.
- [x] Enhance the importer to enumerate matching files per format; when more than one exists, emit an `ERROR`, leave files untouched, revert the book to `MISSING`, and queue `SEARCH_BOOK`.
- [x] Extend importer tests to cover both “single file success” and “multi-file rejection” scenarios.
- [x] Wrap each `queryNewznab` invocation in `fetchReleasesAcrossIndexers` with `try/catch`, logging which indexer failed and continuing with the rest.
- [x] Add per-indexer timeout control (AbortController) plus a concurrency limiter so a hung provider doesn’t block results; include service tests for the failure/timeout path.
- [x] Deduplicate releases: enforce `(bookId, guid)` uniqueness via DB constraint or pre-insert check, and skip candidates that already have active downloads.
- [x] Compare expected runtime-derived sizes against NZB metadata when inserting releases and down-rank or discard obvious “chapter dumps”.
- [x] Refactor job claiming to use a single atomic `UPDATE … RETURNING` pattern, recording `lastError` and attempt counts for visibility.
- [x] Surface job/indexer/importer failures in the Activity feed or a new dashboard badge so operators know why a book stalled.
- [x] Expand the docs (README + deployment guide) to explain the single-file preference and the new resilience behaviors.
- [x] Broaden automated tests to cover queue claim behavior, indexer failure handling, importer guardrails, and UI-visible error surfacing.

