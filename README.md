# ABR · Audiobook Automation

ABR (Audiobook Robot) is a self-hosted workflow that pulls title metadata from Audible, searches your Newznab-compatible indexers for matching audiobook releases, hands approved matches to SABnzbd/NZBGet, and imports completed downloads into an organized `audiobook/{Author}/{Title}` library tree. The dashboard gives you a searchable catalog, activity feed, and settings surface for indexers, download clients, and format priorities.

## Highlights

- 🔍 **Audible search** – query the Audible catalog from the Search view, inspect narrators/runtime/language, and add titles with one click.
- 🤖 **Automated NZB hunts** – the job runner schedules `SEARCH_BOOK → GRAB_RELEASE → POLL_DOWNLOADS → IMPORT_DOWNLOAD` loops until every title is available.
- 🎯 **Single-file focus** – release searches favor one-piece `.m4b` uploads, multi-part results are skipped, and importer guardrails requeue searches when only chapter dumps are available.
- 📚 **Structured library** – authors/titles are sanitized into `audiobook/Author/Title`, cover art is fetched automatically, and importer logs capture every move.
- ⚙️ **Configurable formats & clients** – manage audio formats (M4B/MP3/FLAC/OPUS), SABnzbd/NZBGet clients, and Newznab indexers directly in the dashboard.
- 📒 **Activity tracing** – every notable event (book added, release found, download/import completed, errors) rolls into the Activity tab for auditing.

## Requirements

- Node.js 18+ (or Bun), PNPM/NPM for scripts.
- SQLite (bundled via `better-sqlite3`).
- Audible API credentials capable of fetching `catalog:read` scopes (optional; public endpoints are used when omitted).
- At least one Newznab-compatible audiobook indexer.
- SABnzbd or NZBGet reachable from the server.
- `ffmpeg` available in `PATH` for automatic merging of multi-track releases.

## Quick start

### Local development

1. **Install dependencies**
   ```bash
   bun install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   # update paths and (optionally) add Audible OAuth credentials
   ```
3. **Run the dev server** (migrations are applied automatically on startup)
   ```bash
   bun run dev
   ```
4. Browse to [http://localhost:3000](http://localhost:3000), open Settings, and add your indexers, formats, and download client. Once an Audible title is added it will queue searches automatically.

### Docker

The repo includes a single-service Compose stack that builds and runs ABR:

```bash
docker compose up -d --build
```

This will:
- Build the image (using the multi-stage `Dockerfile`)
- Create volumes `abr_data`, `abr_library`, `abr_downloads`
- Start the container `abr_app` on port 3000

Migrations run automatically when the container boots. Update `.env` before invoking Compose if you need to override defaults (e.g., Audible credentials).

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
| `SERVICE_NAME`, `SERVICE_VERSION`, `DEPLOYMENT_ID`, `REGION` | Metadata stamped on wide-event logs | `abr`, `0.0.0`, *(optional)*, *(optional)* |
| `NEWZNAB_REQUEST_TIMEOUT_MS`, `JOB_CONCURRENCY`, `SEARCH_INTERVAL_MINUTES`, `DOWNLOAD_POLL_INTERVAL_SECONDS` | Operational tuning knobs | see `.env.example` (poll interval defaults to 180s forced cadence) |
| `WIDE_LOG_SAMPLE_RATE`, `WIDE_LOG_SLOW_REQUEST_MS` | Tail-sampling + “slow request” thresholds for structured logs | `0.05`, `2000` |

Operator-level settings (port, active downloader, library root, indexers, formats, download clients) are persisted in the database via the Settings UI and should not be hard-coded in `.env`.

### Configuring the app

Open the **Settings** tab in the UI to manage everything outside of `.env`.

1. **Indexers**
   - Click **Add Indexer** and enter the provider name, base URL (e.g., `https://api.nzbgeek.info`), API key, and default categories. The form accepts comma-separated category ids and automatically adds 3030/3035/3036/3040 if you omit them. Existing indexers can be edited, tested, or deleted via the `…` menu on each card. The UI masks API keys, but the full key is stored in the database.
2. **Formats**
   - The Formats tab controls which file extensions the importer considers. Click **Add Format**, provide a label (e.g., `MP4`), a comma-separated list of extensions (`mp4`), and a priority (lower numbers mean “higher priority”). Disable formats if you want to skip specific containers.
3. **Download Clients**
   - Add SABnzbd or NZBGet instances by selecting the type, host, port, and credentials. The `Category` field should match the queue/category configured in your downloader (ABR defaults to `audiobooks`). Once a client is saved you can test connectivity from the `…` menu.
4. **Path mappings**
   - If your downloader writes to a path that differs from ABR’s filesystem (e.g., SAB sees `/shared/downloads` while ABR sees `/Volumes/nfs-shared/downloads`), create a mapping under **Download Clients → Path mappings**. Set the “Remote path” to the downloader’s view and “Local path” to ABR’s view. The importer rewrites every completed download path using these mappings before moving files.
5. **Default downloader**
   - Under the **Server** tab choose the active download client from the dropdown. ABR queues new releases against that client. This tab also lets you change the library root/port/search interval; after saving, restart if the UI shows “Restart required”.

## Data flow

1. **Search/Add** – The Search page queries Audible (`searchAudiobooks`) with built-in rate limiting. Adding a result stores the ASIN, narrators, runtime, release date, etc., using either the OAuth API (when configured) or the public Audible/Audnexus/Audimeta endpoints.
2. **Automatic search** – The job runner iterates enabled Newznab indexers, tries strict queries first (`m4b -part -disc -cd`), and ignores multi-part or suspiciously small releases before recording the best match.
3. **Download** – Matching releases are queued to the active SABnzbd/NZBGet client under the `audiobooks` category. Polling watches for completion and resolves any remote-to-local path mappings.
4. **Import** – Once the downloader marks a release complete, ABR applies any configured path mappings, logs the resolved download directory, and pre-scans it for audio/video tracks. Single-file releases move straight into `audiobook/{Author}/{Title}`. If the scan finds multiple tracks of the same extension, ABR queues a merge job (via `ffmpeg`) to concatenate them before retrying the import; failures are logged and the search is requeued if merging cannot complete.

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
