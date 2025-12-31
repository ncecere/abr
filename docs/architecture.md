# ABR Architecture

## Runtime overview

- **Framework**: Next.js App Router with the Node.js runtime enforced in every API route. File system and downloader polling are not compatible with the Edge runtime.
- **Database**: SQLite via Drizzle ORM (`better-sqlite3`). The database lives at `var/data/ebr.sqlite` by default and can be relocated with `DATABASE_PATH`.
- **Job system**: A DB-backed queue stored in the `jobs` table. `startJobRunner()` spins up a single worker per process, guarded by a global symbol to prevent duplicate runners during hot reloads.
- **Automation loop**:
  1. User adds a book through the `/api/books` POST handler (or UI). The library folder `audiobook/{author}/{title}` is created immediately, the Audible cover image is downloaded into the folder, the book is persisted with state `MISSING`, and a `SEARCH_BOOK` job is enqueued.
  2. `SEARCH_BOOK` queries every enabled indexer via the Newznab client, applies default audiobook categories (3030/3035/3036/3040) plus an "audiobook" keyword, scores releases, and stores the best match in `releases` before scheduling `GRAB_RELEASE`.
  3. `GRAB_RELEASE` resolves the active SABnzbd/NZBGet client, enqueues the NZB, creates a `downloads` row, and emits `DOWNLOAD_STARTED`.
  4. `POLL_DOWNLOADS` runs on a timer, normalizes downloader responses, and promotes completed records to the importer by queuing `IMPORT_DOWNLOAD`.
  5. `IMPORT_DOWNLOAD` selects the best audiobook file, moves it into `libraryRoot/audiobook/{author}/{title}`, records the file metadata, marks the book `AVAILABLE`, and emits the final activity events.
- **Activity feed**: Append-only `activity_events` table. A small helper (`emitActivity`) centralizes event creation.
- **Audible client**: Rate-limited (5 reqs/s) helper that queries the public Audible catalog endpoints, normalizes contributors/runtime/language, and optionally uses OAuth tokens if supplied. When adding a title we fall back to Audnexus/Audimeta data before pulling the official API.
- **Downloaders**: Thin adapters for SABnzbd (`/api` key auth) and NZBGet (JSON-RPC). Interfaces are normalized to `enqueue` and `getStatus` so the rest of the app does not know implementation details.

## Configuration rules

- `.env` is used strictly for bootstrap (paths, polling defaults). Persistent UI-configurable values flow through the `settings` table.
- Changing the port in Settings flips `settings.restartRequired` to true. The sidebar surfaces a "Restart required" badge so operators know to bounce the container/process manually.
- `libraryRoot` is always ensured on boot and when edits land in the settings API. Each new book also creates its author/title directory immediately so cover art and future imports share the same location.
- Only one downloader can be the active queue target at a time for MVP simplicity.

## Node runtime enforcement

All `app/api/**/route.ts` files export `export const runtime = "nodejs";`. We rely on filesystem access (importer, SQLite) and long-lived timers (job runner) that the Edge runtime cannot provide.

## Directory layout

```
src/
  app/                 ← Next.js routes
  components/         ← UI primitives from Base UI/shadcn
  config/             ← dotenv + env parsing
  db/                 ← schema + client
  lib/
    activity/         ← Activity helper
    domain/           ← enums/constants
    downloaders/      ← SABnzbd/NZBGet adapters
    importer/         ← Filesystem mover
    jobs/             ← Queue, runners, handlers
    logger.ts         ← Pino logger
    matching/         ← Release scoring + normalization
    runtime/          ← bootstrap + init hook
    services/         ← Audible, Newznab, CRUD helpers
    validation/       ← Zod schemas for API payloads
  ui/components/      ← Dashboard-specific components (sidebar, settings panel, etc.)
```
