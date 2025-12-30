# Database schema overview

| Table | Purpose | Key columns |
| --- | --- | --- |
| `settings` | Singleton row for runtime configuration (port, library root, poll interval, active downloader). | `server_port`, `library_root`, `search_interval_minutes`, `active_downloader_client_id`, `restart_required` |
| `formats` | Enabled audiobook formats + priority order. | `name`, `extensions` (JSON), `priority`, `enabled` |
| `indexers` | Newznab-compatible sources. | `name`, `base_url`, `api_key`, `categories` (JSON ints), `priority`, `enabled` |
| `download_clients` | SABnzbd / NZBGet endpoints. | `type`, `host`, `port`, `api_key` OR `username/password`, `category`, `enabled` |
| `books` | Core library records. | `audible_asin`, `title`, `authors_json`, `narrators_json`, `language`, `runtime_seconds`, `state`, `cover_url`, `cover_path`, timestamps |
| `book_files` | Imported files per book. | `book_id`, `path`, `format`, `size`, `imported_at` |
| `releases` | Cached releases chosen from indexers. | `book_id`, `indexer_id`, `guid`, `link`, `size`, `score` |
| `downloads` | Tracks downloader queue items. | `book_id`, `download_client_id`, `downloader_item_id`, `status`, `output_path`, `error` |
| `jobs` | Universal job queue with retry metadata. | `type`, `payload_json`, `status`, `run_at`, `attempts`, `last_error` |
| `activity_events` | Append-only audit log. | `ts`, `type`, `book_id`, `message` |

See `src/db/schema.ts` for full column definitions and Drizzle relations.
