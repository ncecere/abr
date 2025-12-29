## EBR implementation task list (detailed, agent-ready)

Assumptions for this plan (change if needed):

* [X]Next.js App Router
* [X]Node runtime for all API routes (no Edge)
* [X]SQLite for MVP (file-based, easiest for self-host)
* [X]DB-backed “jobs” table for restart safety (recommended)
* [X]Downloader polling (SABnzbd/NZBGet APIs) [X]+ periodic reconciliation
* [X]Open Library is the only metadata source
* [X]States: `MISSING`, `AVAILABLE`

---

# 0) [X]Repo + tooling setup

1. Create repo `ebr`
2. Initialize Next.js (TypeScript) with App Router
3. Add Tailwind
4. Add ESLint + Prettier
5. Add env handling (`dotenv`, Next.js env conventions)
6. Add commit hooks (optional): lint + typecheck
7. Add basic CI (optional): lint, typecheck, unit tests

Deliverables:

* [X]`pnpm|npm` scripts: dev, build, start, lint, typecheck, test
* [X]Tailwind configured, base layout works

---

# 1) [X]Core architecture decisions (must be explicit in code)

8. Enforce Node runtime in routes that need filesystem/network:

   * [X]Add `export const runtime = "nodejs"` in relevant route handlers
9. Define config loading:

   * [X]`.env` only for secrets/bootstrap
   * [X]persistent settings stored in DB (port, indexers, formats, clients)
10. Decide how port setting works:

* [X]UI edits port -> stored in DB -> “restart required” banner
* [X]actual port still controlled by process manager / docker mapping (document this)

Deliverables:

* [X]`docs/architecture.md` describing runtime + config rules
* [X]Settings model includes `serverPort` with “restart required” semantics

---

# 2) [X]Database foundation

11. Choose DB access approach:

* [X]Prisma OR Drizzle OR Kysely OR raw `better-sqlite3`
* [X](Pick one and stick to it)

12. Create migrations system:

* [X]Prisma migrations or Drizzle migrations or custom SQL migration runner

13. Create DB connection module:

* [X]singleton connection
* [X]test connection on server boot

Deliverables:

* [X]`/src/db/*` with connection + migration runner
* [X]`npm run migrate` applies schema

---

# 3) [X]Data model + migrations

Create tables (minimum):

## 3.1 settings

14. `settings` table with single row (id=1):

* [X]`server_port` (int)
* [X]`library_root` (text)
* [X]`search_interval_minutes` (int)
* [X]`active_downloader_client_id` (nullable)
* [X]`created_at`, `updated_at`

## 3.2 formats

15. `formats` table:

* [X]id
* [X]name (EPUB, MOBI, PDF)
* [X]extensions (json array or csv text)
* [X]enabled (bool)
* [X]priority (int, lower = more preferred)

## 3.3 indexers

16. `indexers` table:

* [X]id
* [X]name
* [X]base_url
* [X]api_key
* [X]categories (json)
* [X]enabled (bool)
* [X]priority (int)

## 3.4 download_clients

17. `download_clients` table:

* [X]id
* [X]name
* [X]type (`sabnzbd` | `nzbget`)
* [X]host
* [X]port
* [X]api_key / username/password (as needed)
* [X]category (default ebooks)
* [X]enabled (bool)

## 3.5 books

18. `books` table:

* [X]id
* [X]openlibrary_work_id
* [X]openlibrary_edition_id (nullable)
* [X]title
* [X]authors_json (json array of strings)
* [X]publish_year (nullable)
* [X]description (nullable)
* [X]isbn10 (nullable)
* [X]isbn13 (nullable)
* [X]cover_url (nullable)
* [X]state (`missing` | `available`)
* [X]created_at, updated_at

## 3.6 book_files

19. `book_files` table:

* [X]id
* [X]book_id (fk)
* [X]path
* [X]format
* [X]size
* [X]imported_at

## 3.7 activity_events

20. `activity_events` table:

* [X]id
* [X]ts
* [X]type (enum string)
* [X]book_id (nullable)
* [X]message

## 3.8 jobs

21. `jobs` table:

* [X]id
* [X]type
* [X]payload_json
* [X]status (`queued`|`running`|`succeeded`|`failed`)
* [X]run_at
* [X]attempts
* [X]last_error (nullable)
* [X]created_at, updated_at

## 3.9 releases (optional but recommended)

22. `releases` table:

* [X]id
* [X]book_id
* [X]indexer_id
* [X]guid
* [X]title
* [X]size
* [X]posted_at
* [X]score
* [X]created_at

## 3.10 downloads

23. `downloads` table:

* [X]id
* [X]book_id
* [X]download_client_id
* [X]downloader_item_id (string)
* [X]status (`queued`|`downloading`|`completed`|`failed`)
* [X]output_path (nullable)
* [X]error (nullable)
* [X]updated_at

Deliverables:

* [X]Migrations committed
* [X]DB schema documented (`docs/schema.md`)

---

# 4) [X]Domain types + constants

24. Create `src/lib/domain/*`:

* [X]enums:

  * [X]BookState: MISSING/AVAILABLE
  * [X]ActivityType
  * [X]JobType
  * [X]DownloadStatus
  * [X]DownloaderType

25. Create validation schemas (zod):

* [X]settings update payloads
* [X]indexer create/update payloads
* [X]format create/update payloads
* [X]download client create/update payloads
* [X]add book payloads

Deliverables:

* [X]Shared types used by both API routes and UI

---

# 5) [X]Open Library integration

26. Implement Open Library client module:

* [X]`searchBooks(query)` -> list of results (work + minimal fields)
* [X]`getWork(workId)` -> work details
* [X]`getEdition(editionId)` (optional)
* [X]logic to extract ISBNs from editions if needed

27. Normalize Open Library data into internal book model:

* [X]title, authors, description, year, isbn, cover url

Deliverables:

* [X]`src/lib/openlibrary/client.ts` with unit tests
* [X]rate limiting/backoff (basic)

---

# 6) [X]Newznab integration

28. Implement Newznab client:

* [X]build request URLs correctly
* [X]handle categories, limits, offsets
* [X]parse XML responses to structured objects

29. Support multiple indexers:

* [X]iterate enabled indexers by priority
* [X]unify results list with source indexer_id

Deliverables:

* [X]`src/lib/newznab/client.ts` + parser
* [X]integration test with mocked XML

---

# 7) [X]Matching + scoring engine

30. Implement normalization helpers:

* [X]title normalization (lowercase, strip punctuation)
* [X]author token normalization

31. Implement release parsing:

* [X]detect format by extension/title tokens
* [X]detect audiobook/comic tokens
* [X]detect ISBN inside string (10/13)

32. Implement scoring function:

* [X]hard reject rules
* [X]score components (ISBN, title similarity, author match, format preference)

33. Implement selection policy:

* [X]threshold config
* [X]choose best scoring

34. Implement optional blacklist mechanism (later):

* [X]store rejected GUIDs per book

Deliverables:

* [X]`src/lib/matching/*`
* [X]unit tests covering common tricky cases

---

# 8) [X]Download client integrations

## 8.1 SABnzbd

35. Implement SAB client:

* [X]add NZB via URL/guid (depending on indexer)
* [X]set category
* [X]set name/tag containing book_id
* [X]query queue/history
* [X]map item id -> status -> output path

## 8.2 NZBGet

36. Implement NZBGet client similarly:

* [X]append
* [X]list groups/history
* [X]resolve completed directory

Deliverables:

* [X]`src/lib/downloaders/sabnzbd.ts`
* [X]`src/lib/downloaders/nzbget.ts`
* [X]unified interface `DownloadClient` with:

  * [X]`enqueue(nzbUrlOrContent, meta)`
  * [X]`getStatus(itemId)`
  * [X]`getCompletedPath(itemId)` (or include in status)
* [X]integration tests with mocked HTTP

---

# 9) [X]Importer (filesystem)

37. Implement path templating:

* [X]sanitize author/title for filesystem
* [X]final directory:

  * [X]`${libraryRoot}/ebook/${author}/${title}/`

38. Implement file selection from completed download folder:

* [X]scan recursively
* [X]filter by allowed extensions from enabled formats
* [X]prefer formats by priority
* [X]ignore known junk (nfo, txt, images)

39. Implement move/rename:

* [X]ensure destination directories exist
* [X]handle conflicts:

  * [X]if file exists, either overwrite, rename with suffix, or skip (decide)

40. Record imported file in DB:

* [X]create book_files row
* [X]set book state AVAILABLE

41. Emit activity events:

* [X]IMPORT_COMPLETED
* [X]BOOK_AVAILABLE

Deliverables:

* [X]`src/lib/importer/*`
* [X]unit tests using temp directories

---

# 10) [X]Activity event system

42. Implement `emitActivity(type, bookId?, message)` helper:

* [X]writes to `activity_events`

43. Define event messages consistently
44. Add retention option (optional):

* [X]keep last N days or N rows

Deliverables:

* [X]activity emission used throughout add/search/download/import

---

# 11) [X]Job system (DB-backed)

45. Implement job runner loop (server-side):

* [X]poll for due jobs: status queued, run_at <= now
* [X]claim job (atomic update to running)
* [X]execute handler based on job type
* [X]update status + attempts + last_error

46. Implement job scheduling helpers:

* [X]`enqueueJob(type, payload, runAt=now)`

47. Implement recurring scheduler:

* [X]every `search_interval_minutes`, enqueue `SEARCH_MISSING_BOOKS`
* [X]also enqueue `POLL_DOWNLOADS` every N seconds/minutes

48. Ensure runner starts once:

* [X]avoid multiple runners in dev HMR (use global singleton guard)

Job types (MVP):
49. `SEARCH_BOOK(book_id)`:

* [X]search indexers
* [X]score releases
* [X]pick best
* [X]enqueue `GRAB_RELEASE(book_id, release)`

50. `SEARCH_MISSING_BOOKS`:

* [X]list missing books
* [X]enqueue `SEARCH_BOOK` for each (rate limited)

51. `GRAB_RELEASE(book_id, release)`:

* [X]send to active download client
* [X]create downloads row
* [X]emit DOWNLOAD_STARTED

52. `POLL_DOWNLOADS`:

* [X]find downloads not completed/failed
* [X]poll downloader
* [X]update status
* [X]when completed, enqueue `IMPORT_DOWNLOAD(book_id, download_id)`

53. `IMPORT_DOWNLOAD(book_id, download_id)`:

* [X]resolve completed path
* [X]import
* [X]set AVAILABLE

Deliverables:

* [X]`src/lib/jobs/*` with handlers + runner
* [X]idempotency: handlers should be safe to retry

---

# 12) [X]API routes (Next.js)

Implement route handlers (Node runtime):

## Search

54. `GET /api/search?query=`:

* [X]calls Open Library search
* [X]returns results (no DB write)

55. `POST /api/books` (Add):

* [X]payload: openlibrary_work_id (and optionally edition id)
* [X]fetch details from Open Library
* [X]insert book as MISSING
* [X]emit BOOK_ADDED
* [X]enqueue SEARCH_BOOK
* [X]return created book

## Library

56. `GET /api/books` (filters: state, q)
57. `GET /api/books/:id`
58. (Optional) `DELETE /api/books/:id`

## Activity

59. `GET /api/activity` (pagination)

## Settings

60. `GET /api/settings`
61. `PUT /api/settings`:

* [X]update server port, library root, intervals, active downloader client
* [X]emit SETTINGS_UPDATED (optional)

## Indexers CRUD

62. `GET /api/indexers`
63. `POST /api/indexers`
64. `PUT /api/indexers/:id`
65. `DELETE /api/indexers/:id`

## Formats CRUD

66. `GET /api/formats`
67. `POST /api/formats`
68. `PUT /api/formats/:id`
69. `DELETE /api/formats/:id`

## Download clients CRUD

70. `GET /api/download-clients`
71. `POST /api/download-clients`
72. `PUT /api/download-clients/:id`
73. `DELETE /api/download-clients/:id`

Deliverables:

* [X]consistent error format (problem+json or custom)
* [X]zod validation
* [X]auth omitted for MVP (or simple token later)

---

# 13) [X]UI implementation (Sidebar + pages)

## 13.1 Layout

74. Create app shell with Sidebar:

* [X]Search
* [X]Library
* [X]Activity
* [X]Settings

75. Add route pages:

* [X]`/search`
* [X]`/library`
* [X]`/activity`
* [X]`/settings`

## 13.2 Search page

76. Search input + debounce
77. Results list cards
78. “Add to Library” button per result
79. Toast/feedback on add
80. Navigate to Book detail (optional)

## 13.3 Library page

81. List books with state badge
82. Filters: missing/available/all
83. Search box
84. Row/click to detail page `/library/:id`
85. Book detail:

* [X]metadata
* [X]state
* [X]file path if available
* [X]activity snippet (optional)

## 13.4 Activity page

86. Timeline feed of `activity_events`
87. Pagination / infinite scroll

## 13.5 Settings page

88. Server settings form:

* [X]port (show “restart required”)
* [X]library root
* [X]intervals

89. Indexers management UI:

* [X]list + add + edit + delete modal

90. Formats management UI:

* [X]list + add + edit + delete
* [X]priority ordering UI (up/down)

91. Download clients management UI:

* [X]list + add + edit + delete
* [X]set active client

Deliverables:

* [X]consistent components (forms, tables, modals)
* [X]Tailwind styling

---

# 14) [X]Operational behavior + docs

92. Add `docs/configuration.md`:

* [X]how to set up indexers
* [X]how to set up SABnzbd/NZBGet
* [X]library root requirements
* [X]port behavior explanation (restart required)

93. Add `docs/deployment.md`:

* [X]docker compose example (optional)
* [X]volume mounts:

  * [X]library root
  * [X]downloads directory (if needed)

94. Add “first-run” behavior:

* [X]bootstrap settings row
* [X]bootstrap default formats (EPUB/MOBI/PDF)

95. Add health endpoint:

* [X]`GET /api/health` (DB ok, worker running)

---

# 15) [X]Quality + safety checks

96. Add unit tests:

* [X]matching/scoring
* [X]Open Library normalization
* [X]importer file selection

97. Add integration tests (mock HTTP):

* [X]Newznab parsing
* [X]downloader enqueue + polling mapping

98. Add logging:

* [X]structured logs for jobs

99. Add rate limiting:

* [X]Open Library search requests
* [X]indexer query throttling

100. Add idempotency rules:

* [X]do not enqueue duplicate downloads for same book if already downloading/available
* [X]if book is AVAILABLE, search jobs no-op

---

# 16) [X]“Done” checklist (MVP acceptance)

101. Search page returns Open Library results
102. Add-to-library persists book as MISSING
103. Background job searches indexers and selects release
104. Download is enqueued in SABnzbd/NZBGet
105. Poller detects completion
106. Importer moves/renames into `ebook/{author}/{title}/`
107. Book state becomes AVAILABLE and file path is stored
108. Activity feed shows:

* [X]BOOK_ADDED
* [X]RELEASE_FOUND
* [X]DOWNLOAD_STARTED
* [X]DOWNLOAD_COMPLETED
* [X]IMPORT_COMPLETED
* [X]BOOK_AVAILABLE

109. Settings CRUD works for:

* [X]indexers
* [X]formats
* [X]download clients
* [X]server port stored + restart banner

---

## Notes you should include for the AI agent (important)

* [X]Do not implement advanced states beyond MISSING/AVAILABLE.
* [X]Activity is an append-only event feed, not a queue UI.
* [X]Port setting is persisted config; actual binding may require restart.
* [X]Avoid Edge runtime; filesystem and downloader polling require Node runtime.
* [X]Prefer DB-backed jobs so restarts don’t lose work.

If you want, I can convert this into a set of GitHub issues (titles + descriptions + labels + dependencies) in a ready-to-import format.
