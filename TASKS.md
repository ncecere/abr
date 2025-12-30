# Audiobook Migration Tasks

## 1. Replace Open Library metadata with Audible
- [X] Confirm which Audible API/marketplace we can rely on (public Product Advertising API vs. 3rd-party wrappers) and document required auth (client id/secret, marketplace, language/region). Add the new env keys to `src/config/env.ts`, `.env.example`, deployment docs, and describe how tokens are refreshed/cached.
- [X] Implement a new `src/lib/services/audible.ts` (mirroring the structure of `openlibrary.ts`) that exposes `searchAudiobooks`, `getTitle`, and `normalizeAudiobook`. Handle rate limiting, OAuth token caching, pagination, and map Audible fields (ASIN, title, author(s), narrator(s), runtime, release date, description, cover art URLs, sample clip URL).
- [X] Delete the Open Library client/tests once parity is reached, and migrate all imports (`src/app/api/search/route.ts`, `src/lib/services/books.ts`, tests, etc.) to the new Audible service. Update `SearchClient` to expect Audible-shaped data (ASIN instead of work/edition ids).
- [X] Update `addBook` flow to persist narrator JSON, runtime (seconds), Audible ASIN, language, and any other metadata we expose in the UI. Ensure cover art downloads now accept Audible image URLs (typically https) and handle token headers if necessary.

## 2. Database + Drizzle schema migrations
- [X] Create a Drizzle migration that renames `books.openlibrary_work_id`/`openlibrary_edition_id` to something Audible-specific (`audible_asin`, `audible_product_id`), adds narrator/runtime/language columns, and drops ISBN fields if we no longer receive them. Update `src/db/schema.ts`, `docs/schema.md`, and generated snapshots.
- [X] Write a data migration (SQL or script) to backfill the new fields for existing rows (if this repo already contains data) or to null them safely so the UI/job runner continue working.
- [X] Update all TypeScript types (`NormalizedBook`, `Book` usages, validation schema in `src/lib/validation/schemas.ts`, Vitest fixtures) to match the new columns.

## 3. Search + UI copy updates
- [X] Refresh the `/search` route and `SearchClient` copy so it reads "Search Audible" and the input placeholder cites ASIN instead of ISBN. Display narrator+runtime badges in the result cards so operators can confirm they are selecting the correct audiobook release.
- [X] Update `Sidebar`, `RootLayout` metadata, and any other marketing strings to refer to "audiobook automation" instead of "ebook".
- [X] Extend the library detail views (`src/app/(dashboard)/library/[id]/page.tsx`, `library-grid.tsx`) to surface new fields (narrators, runtime, language, release date) once they exist in the DB.

## 4. Indexer + release search adjustments
- [X] Replace `DEFAULT_EBOOK_CATEGORIES` with audio-centric defaults (e.g., Newznab 3030/3035/3036) in `src/lib/services/release-search.ts`, `src/ui/components/settings-panel.tsx`, and `src/app/api/indexers/test/route.ts`. Ensure the settings UI still lets operators append custom categories without losing the baked-in audio ones.
- [X] Consider appending an explicit "audiobook" keyword to the constructed search query (`buildSearchQuery`) so general media releases don't outrank audio-specific posts.
- [X] Verify that manual search (`/api/manual-search`) and automatic search both serialize the ASIN/narrator metadata if needed for better scoring downstream.

## 5. Matching heuristics
- [X] Remove the guard in `src/lib/matching/index.ts` that currently discards audiobook releases, and flip the heuristic to *prefer* titles containing audiobook/audio-format cues (m4b/mp3/flac/bitrate). Down-rank obvious ebook/comic releases instead.
- [X] Incorporate narrator/runtime or ASIN hits into the score (e.g., +0.3 when release title includes the ASIN). Update the Vitest suite in `src/lib/matching/index.test.ts` to reflect the new expectations.

## 6. Formats, importer, and library layout
- [X] Update `DEFAULT_FORMATS` in `src/lib/runtime/bootstrap.ts` to seed audio formats (M4B, MP3, FLAC, OPUS) with appropriate extensions, and adjust the importer tests/logic so it favors full-length audiobook containers before episodic MP3 folders.
- [X] Change `getBookDirectory` to write into `<libraryRoot>/audiobook/...` (and migrate/rename existing `ebook/` directories where necessary). Update docs/configuration to explain the new folder layout.
- [X] Update the importer log + activity copy to say "imported audiobook" and make sure `collectFiles` + format detection behave well for nested CD/disc folder structures that are common for audiobooks.

## 7. Download client defaults & categories
- [X] Change the default SABnzbd/NZBGet category from `ebooks` to something like `audiobooks` throughout (`download_clients` schema default, validation schema, UI defaults, `docs/configuration.md`). Communicate in the docs that operators must create the matching category in their downloader.
- [X] Re-run the downloader test harnesses (`src/lib/downloaders/sabnzbd.test.ts`, etc.) to assert the new defaults and adjust fixtures accordingly.

## 8. Documentation & onboarding assets
- [X] Rewrite `README.md`, `docs/architecture.md`, `docs/configuration.md`, and `docs/deployment.md` to describe the audiobook workflow (Audible metadata, audio library tree, audio formats, indexer categories).
- [X] Document the new Audible environment variables, token refresh behavior, and any rate-limit considerations. Include troubleshooting tips for common Audible API errors.
- [X] Add a migration note section explaining how existing ebook libraries can transition (e.g., run migration script X, rename folders, rescan downloads).

## 9. Validation & QA
- [X] Update the API/request validation schemas and manual-search modal to send/accept Audible identifiers, then add integration tests that simulate searching, grabbing, downloading, and importing an audiobook end-to-end (possibly using MSW fixtures for Audible + Newznab responses).
- [X] Smoke-test the UI (search, add, manual search, automatic search, download import) against mocked Audible + indexer responses to ensure the job runner still progresses through SEARCH_BOOK -> IMPORT_DOWNLOAD without ebook-specific assumptions.

