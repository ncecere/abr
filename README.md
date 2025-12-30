# EBR · Audiobook Automation

EBR (Audiobook Robot) is a self-hosted workflow that pulls title metadata from Audible, searches your Newznab-compatible indexers for matching audiobook releases, hands approved matches to SABnzbd/NZBGet, and imports completed downloads into an organized `audiobook/{Author}/{Title}` library tree. The dashboard gives you a searchable catalog, activity feed, and settings surface for indexers, download clients, and format priorities.

## Highlights

- 🔍 **Audible search** – query the Audible catalog from the Search view, inspect narrators/runtime/language, and add titles with one click.
- 🤖 **Automated NZB hunts** – the job runner schedules `SEARCH_BOOK → GRAB_RELEASE → POLL_DOWNLOADS → IMPORT_DOWNLOAD` loops until every title is available.
- 📚 **Structured library** – authors/titles are sanitized into `audiobook/Author/Title`, cover art is fetched automatically, and importer logs capture every move.
- ⚙️ **Configurable formats & clients** – manage audio formats (M4B/MP3/FLAC/OPUS), SABnzbd/NZBGet clients, and Newznab indexers directly in the dashboard.
- 📒 **Activity tracing** – every notable event (book added, release found, download/import completed, errors) rolls into the Activity tab for auditing.

## Requirements

- Node.js 18+ (or Bun), PNPM/NPM for scripts.
- SQLite (bundled via `better-sqlite3`).
- Audible API credentials capable of fetching `catalog:read` scopes (optional; public endpoints are used when omitted).
- At least one Newznab-compatible audiobook indexer.
- SABnzbd or NZBGet reachable from the server.

## Quick start

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   # update paths and (optionally) add Audible OAuth credentials
   ```
3. **Apply database migrations**
   ```bash
   npm run db:migrate
   ```
4. **Run the dev server**
   ```bash
   npm run dev
   ```
5. Browse to [http://localhost:3000](http://localhost:3000), open Settings, and add your indexers, formats, and download client. Once an Audible title is added it will queue searches automatically.

## Configuration overview

Key environment variables live in `.env` and are parsed by `src/config/env.ts`:

| Key | Purpose | Default |
| --- | --- | --- |
| `AUDIBLE_CLIENT_ID` / `AUDIBLE_CLIENT_SECRET` | OAuth client credentials for Audible (leave blank to use public endpoints only) | *(optional)* |
| `AUDIBLE_MARKETPLACE` / `AUDIBLE_LOCALE` | Marketplace/locale for catalog requests when OAuth is enabled | `us` / `en-US` |
| `AUDIBLE_REGION` | Region suffix for the public Audible endpoints / Audnexus (us, ca, uk, …) | `us` |
| `AUDIBLE_API_BASE_URL` / `AUDIBLE_TOKEN_URL` | Override API/token hosts if you proxy traffic | `https://api.audible.com` / `https://api.audible.com/1.0/oauth2/token` |
| `DATABASE_PATH` | SQLite database file | `var/data/abr.sqlite` |
| `DOWNLOADS_DIR` | Where SABnzbd/NZBGet drops finished jobs | `var/downloads` |
| `LIBRARY_ROOT` | Parent directory for the managed `audiobook/` tree | `var/library` |
| `NEWZNAB_REQUEST_TIMEOUT_MS`, `JOB_CONCURRENCY`, `SEARCH_INTERVAL_MINUTES`, `DOWNLOAD_POLL_INTERVAL_SECONDS` | Operational tuning knobs | see `.env.example` |

Operator-level settings (port, active downloader, library root, indexers, formats, download clients) are persisted in the database via the Settings UI and should not be hard-coded in `.env`.

## Data flow

1. **Search/Add** – The Search page queries Audible (`searchAudiobooks`) with built-in rate limiting. Adding a result stores the ASIN, narrators, runtime, release date, etc., using either the OAuth API (when configured) or the public Audible/Audnexus/Audimeta endpoints.
2. **Automatic search** – The job runner iterates enabled Newznab indexers and forces audiobook categories (3030/3035/3036/3040) so results stay audio-focused without extra keywords.
3. **Download** – Matching releases are queued to the active SABnzbd/NZBGet client under the `audiobooks` category. Polling watches for completion and resolves any remote-to-local path mappings.
4. **Import** – Completed downloads are scanned for the highest-priority audio format, moved into `audiobook/{Author}/{Title}`, recorded in `book_files`, and marked `AVAILABLE`.

## Testing

Vitest covers utilities, importers, download clients, and matching heuristics:

```bash
npm test
```

Run `npm run lint` / `npm run typecheck` if you change shared types or config.

## Migrating from the ebook build

1. Pull the latest code and run `npm run db:migrate` to apply `0003_audiobook_overhaul` (renames columns, drops ISBNs, updates defaults).
2. Rename your library tree from `LIBRARY_ROOT/ebook` to `LIBRARY_ROOT/audiobook`. Existing author/title folders can be moved as-is.
3. Update SABnzbd/NZBGet categories so the UI's `audiobooks` default matches a real queue category.
4. Rescan or re-import any downloads that still point at the old folder structure.

## Deployment notes

- See `docs/deployment.md` for Docker Compose and production tips.
- Mount `var/data`, `var/downloads`, and `var/library` volumes so the downloader and importer share the same filesystem.
- If you use Audible OAuth, store the credentials as environment secrets; otherwise the public endpoints work without additional configuration.
