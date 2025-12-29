import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { env } from "@/config";
import { db } from "@/db/client";
import { books, formats, settings } from "@/db/schema";
import { logger } from "@/lib/logger";

export const DEFAULT_LIBRARY_ROOT = env.LIBRARY_ROOT ?? path.resolve("var", "library");

const DEFAULT_FORMATS = [
  { name: "EPUB", extensions: ["epub"], priority: 0 },
  { name: "MOBI", extensions: ["mobi"], priority: 1 },
  { name: "PDF", extensions: ["pdf"], priority: 2 },
];

export async function bootstrapDatabase() {
  ensureDirectory(path.dirname(env.DATABASE_PATH));
  ensureDirectory(env.DOWNLOADS_DIR);

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
    logger.info("seeded default ebook formats");
  }

  await db.delete(books).where(eq(books.title, "Test Book"));
}

export async function ensureLibraryRootSync(libraryRoot?: string) {
  const root = libraryRoot ?? (await getLibraryRoot());
  ensureDirectory(path.join(root, "ebook"));
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
