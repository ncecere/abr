import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { env } from "@/config";
import { db } from "@/db/client";
import { books, formats, settings } from "@/db/schema";
import { logger } from "@/lib/logger";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
export const DEFAULT_LIBRARY_ROOT = env.LIBRARY_ROOT ?? path.resolve("var", "library");

const DEFAULT_FORMATS = [
  { name: "M4B", extensions: ["m4b"], priority: 0 },
  { name: "MP3", extensions: ["mp3"], priority: 1 },
  { name: "FLAC", extensions: ["flac"], priority: 2 },
  { name: "OPUS", extensions: ["opus"], priority: 3 },
];

export async function bootstrapDatabase() {
  ensureDirectory(path.dirname(env.DATABASE_PATH));
  ensureDirectory(env.DOWNLOADS_DIR);

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (error) {
    logger.error({ err: error }, "failed to apply database migrations");
    throw error;
  }

  const currentSettings = await db.query.settings.findFirst();
  if (!currentSettings) {
    await db.insert(settings).values({
      serverPort: 3000,
      libraryRoot: DEFAULT_LIBRARY_ROOT,
      searchIntervalMinutes: env.SEARCH_INTERVAL_MINUTES,
      restartRequired: false,
    });
    logger.info({ libraryRoot: DEFAULT_LIBRARY_ROOT }, "created initial settings row");
  }

  const existingFormats = await db.query.formats.findMany();
  if (existingFormats.length === 0) {
    await db.insert(formats).values(
      DEFAULT_FORMATS.map((format) => ({
        name: format.name,
        extensions: JSON.stringify(format.extensions),
        priority: format.priority,
      })),
    );
    logger.info("seeded default audiobook formats");
  }

  await db.delete(books).where(eq(books.title, "Test Book"));
}

export async function ensureLibraryRootSync(libraryRoot?: string) {
  const root = libraryRoot ?? (await getLibraryRoot());
  ensureDirectory(path.join(root, "audiobook"));
}

async function getLibraryRoot() {
  const currentSettings = await db.query.settings.findFirst();
  return currentSettings?.libraryRoot ?? DEFAULT_LIBRARY_ROOT;
}

function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
