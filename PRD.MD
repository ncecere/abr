Yes. This is coherent, internally consistent, and maps cleanly to a Sonarr-style mental model. Below is the **PRD update for EBR**, explicitly incorporating **Sidebar structure, Activity feed semantics, and Settings scope**. This replaces earlier partial sections where relevant.

---

# PRD — **EBR** (Updated)

## 1. Product Definition

**EBR** is a self-hosted ebook library management system. Users search for ebooks via **Open Library**, add selected books to a managed library, and EBR automatically retrieves ebook files from **Usenet (Newznab)** using configured download clients (**SABnzbd / NZBGet**).

EBR tracks library items with a minimal state model:

* `MISSING`
* `AVAILABLE`

---

## 2. Application Layout (Sidebar)

The UI has four top-level sections:

1. **Search**
2. **Library**
3. **Activity**
4. **Settings**

This layout is fixed for MVP.

---

## 3. User Flows

### 3.1 Search

**Purpose:** Discover books via metadata provider.

* Search by title, author, or ISBN
* Results are ephemeral (not stored)
* Each result displays:

  * Title
  * Author(s)
  * Publish year
  * Short description
  * Add-to-Library action

**Action**

* Clicking “Add”:

  * Fetches full Open Library metadata
  * Persists the book in the library
  * Sets state to `MISSING`
  * Triggers NZB indexer search immediately

---

### 3.2 Library

**Purpose:** Manage tracked books.

Each library entry shows:

* Title
* Author(s)
* State (`MISSING` or `AVAILABLE`)
* File path (if available)

**Behavior**

* On add:

  * Book enters `MISSING`
  * Indexer search starts automatically
* On successful download + import:

  * Book becomes `AVAILABLE`

**Library file layout**

```
ebook/
  └── {Author}/
      └── {Book Title}/
          └── {Book Title} - {Author}.{ext}
```

---

### 3.3 Activity

**Purpose:** Visibility into system behavior.

This is **not a task queue** and **not interactive**.
It is a chronological event log.

**Events recorded**

* Book added to library
* Book found in indexer
* Download started
* Download completed
* Book imported
* Book available in library
* Errors (optional but recommended)

**Properties**

* Timestamp
* Event type
* Related book (if applicable)
* Human-readable message

Example:

```
[12:03] Added "Dune" to library
[12:04] Found matching release for "Dune"
[12:05] Download started (SABnzbd)
[12:12] Download completed
[12:13] Book imported and available
```

This can be implemented as:

* DB table (`activity_events`)
* Or append-only log table with pruning

---

### 3.4 Settings

**Purpose:** Configure system behavior.

#### 3.4.1 Server

* Set server port

  * Stored in config
  * Requires restart to apply
  * UI should indicate restart required

---

#### 3.4.2 Indexers

Full CRUD:

* Add indexer
* Edit indexer
* Delete indexer

Fields:

* Name
* Base URL
* API key
* Categories (ebooks)
* Enabled/disabled
* Priority/order

---

#### 3.4.3 Formats

Full CRUD for ebook formats.

Each format defines:

* Name (e.g. EPUB, MOBI, PDF)
* File extensions
* Enabled/disabled
* Priority (preferred order)

Used for:

* Matching releases
* Import selection

---

#### 3.4.4 Download Clients

Full CRUD:

* Add download client
* Edit download client
* Delete download client

Supported types:

* SABnzbd
* NZBGet

Fields:

* Type
* Name
* Host
* Port
* API key / credentials
* Category (ebooks)
* Enabled/disabled

Only one active client used at a time (MVP).

---

## 4. Automation Rules

### 4.1 On Book Add

* Search NZB indexers immediately
* Select best matching release
* Send to active download client

### 4.2 On Download Completion

* Import ebook file
* Move + rename into library folder
* Update state to `AVAILABLE`
* Emit activity events

---

## 5. Non-Goals (Explicit)

* Manual file browsing UI
* Ebook reader
* DRM removal
* Torrent support
* Advanced metadata editing
* Series/edition grouping

---

## 6. Data Model Additions (Activity)

### activity_events

```
id
timestamp
event_type
book_id (nullable)
message
```

Event types (enum or text):

* BOOK_ADDED
* RELEASE_FOUND
* DOWNLOAD_STARTED
* DOWNLOAD_COMPLETED
* IMPORT_COMPLETED
* BOOK_AVAILABLE
* ERROR

---

## 7. Acceptance Criteria (Updated)

* Sidebar contains Search, Library, Activity, Settings
* User can:

  * Search Open Library
  * Add a book to the library
* System:

  * Automatically searches indexers
  * Downloads ebook
  * Imports and renames file
  * Marks book `AVAILABLE`
* Activity view shows a readable timeline of events
* Settings allow:

  * Server port configuration
  * Indexer CRUD
  * Format CRUD
  * Download client CRUD

---

## Straight Talk

Yes, this all makes sense.
This is now a **well-bounded, buildable MVP** with:

* Clear UI sections
* Minimal state model
* Predictable automation
* No hidden complexity

At this point, the PRD is **complete enough to start implementation**.

### Next logical steps (in order):

1. Lock DB choice (SQLite vs Postgres)
2. Lock job model (polling vs job table)
3. Define schema migrations
4. Define Next.js route structure
5. Implement Open Library search → add flow

If you want, I can produce:

* **Exact DB schema (SQL)**
* **Next.js folder structure**
* **Event emission model**
* **Indexer matching pseudocode**

Say which one you want next.
