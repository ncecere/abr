import { InferInsertModel, InferSelectModel, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const downloadClients = sqliteTable("download_clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  apiKey: text("api_key"),
  username: text("username"),
  password: text("password"),
  category: text("category").notNull().default("ebooks"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().$default(() => 1),
  serverPort: integer("server_port").notNull().default(3000),
  libraryRoot: text("library_root").notNull(),
  searchIntervalMinutes: integer("search_interval_minutes").notNull().default(60),
  activeDownloaderClientId: integer("active_downloader_client_id")
    .references(() => downloadClients.id, { onDelete: "set null" }),
  restartRequired: integer("restart_required", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const formats = sqliteTable("formats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  extensions: text("extensions", { length: 256 }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const indexers = sqliteTable("indexers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  categories: text("categories").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    openLibraryWorkId: text("openlibrary_work_id").notNull(),
    openLibraryEditionId: text("openlibrary_edition_id"),
    title: text("title").notNull(),
    authorsJson: text("authors_json").notNull(),
    publishYear: integer("publish_year"),
    description: text("description"),
    isbn10: text("isbn10"),
    isbn13: text("isbn13"),
    coverUrl: text("cover_url"),
    state: text("state").notNull().default("MISSING"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    workIdIdx: uniqueIndex("books_work_idx").on(table.openLibraryWorkId),
    stateIdx: index("books_state_idx").on(table.state),
  })
);

export const bookFiles = sqliteTable("book_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id")
    .references(() => books.id, { onDelete: "cascade" })
    .notNull(),
  path: text("path").notNull(),
  format: text("format").notNull(),
  size: integer("size").notNull(),
  importedAt: integer("imported_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const activityEvents = sqliteTable("activity_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: integer("ts", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  type: text("type").notNull(),
  bookId: integer("book_id").references(() => books.id, { onDelete: "set null" }),
  message: text("message").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  payload: text("payload_json").notNull(),
  status: text("status").notNull().default("queued"),
  runAt: integer("run_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const releases = sqliteTable("releases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id")
    .references(() => books.id, { onDelete: "cascade" })
    .notNull(),
  indexerId: integer("indexer_id")
    .references(() => indexers.id, { onDelete: "cascade" })
    .notNull(),
  guid: text("guid").notNull(),
  title: text("title").notNull(),
  link: text("link").notNull(),
  size: integer("size"),
  postedAt: integer("posted_at", { mode: "timestamp" }),
  score: integer("score"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const downloads = sqliteTable("downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id")
    .references(() => books.id, { onDelete: "cascade" })
    .notNull(),
  downloadClientId: integer("download_client_id")
    .references(() => downloadClients.id, { onDelete: "set null" })
    .notNull(),
  downloaderItemId: text("downloader_item_id").notNull(),
  status: text("status").notNull().default("queued"),
  outputPath: text("output_path"),
  error: text("error"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export type Settings = InferSelectModel<typeof settings>;
export type InsertSettings = InferInsertModel<typeof settings>;
export type Book = InferSelectModel<typeof books>;
export type InsertBook = InferInsertModel<typeof books>;
export type Format = InferSelectModel<typeof formats>;
export type Indexer = InferSelectModel<typeof indexers>;
export type DownloadClient = InferSelectModel<typeof downloadClients>;
export type ActivityEvent = InferSelectModel<typeof activityEvents>;
export type Job = InferSelectModel<typeof jobs>;
export type Release = InferSelectModel<typeof releases>;
export type Download = InferSelectModel<typeof downloads>;
