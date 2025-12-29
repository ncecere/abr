# Configuration guide

## Environment variables

| Key | Description | Default |
| --- | --- | --- |
| `DATABASE_PATH` | Absolute or relative path for the SQLite file. | `var/data/ebr.sqlite` |
| `DOWNLOADS_DIR` | Directory where downloader clients deposit completed content for import. | `var/downloads` |
| `LIBRARY_ROOT` | Optional override for the managed `ebook/` tree. If omitted we fall back to `var/library`. | — |
| `OPEN_LIBRARY_BASE_URL` | Allows pointing to an alternate Open Library host (useful for proxies). | `https://openlibrary.org` |
| `NEWZNAB_REQUEST_TIMEOUT_MS` | HTTP timeout for Newznab queries. | `10000` |
| `JOB_CONCURRENCY` | Number of concurrent job executions per process. | `3` |
| `SEARCH_INTERVAL_MINUTES` | Scheduler cadence for `SEARCH_MISSING_BOOKS`. | `60` |
| `DOWNLOAD_POLL_INTERVAL_SECONDS` | Poll frequency for downloader status checks. | `45` |

`.env` should only be used for bootstrap/runtime values. All operator-facing configuration (port binding, download client selection, format priorities, indexer credentials) is edited through the Settings UI and persisted to the database.

## Settings semantics

- **Port**: Updating the port toggles `restartRequired=true`. The app cannot restart itself; surface-level banner reminds you to restart the process/container after editing.
- **Library root**: Changing the root ensures `${root}/ebook` exists immediately. Every new book pre-creates `${root}/ebook/{Author}/{Title}`, stores downloaded cover art there, and the importer later drops files into the same directory.
- **Search interval**: Drives the recurring scheduler. Setting overly aggressive intervals may hit rate limits on Newznab/Open Library.
- **Active downloader**: Exactly one download client can be active at a time. Jobs will no-op and log an error if the row disappears or is disabled.

## Indexers

- Provide the base URL and API key for each Newznab source.
- Categories are stored as a JSON array of ints; they are passed verbatim to the `cat` query parameter.
- Priority controls iteration order (lower value first). Disabling an indexer removes it from search rotations without losing data.

## Formats

- Each format row is `{ name, extensions[], priority }`.
- The importer scans completed downloads by allowed extensions in priority order. First match wins.

## Download clients

- `type` is `sabnzbd` or `nzbget`.
- SABnzbd: supply API key + host/port.
- NZBGet: supply username/password (and API key if applicable). We talk to `/jsonrpc`.
- Only enabled clients are shown in the Settings dropdown; the selected client ID is written to `settings.activeDownloaderClientId`.
