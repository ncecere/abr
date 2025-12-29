import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { SettingsUpdateInput } from "@/lib/validation/schemas";
import { ensureLibraryRootSync } from "@/lib/runtime/bootstrap";

export async function getSettings() {
  return db.query.settings.findFirst();
}

export async function updateSettings(input: SettingsUpdateInput) {
  const current = await getSettings();
  if (!current) throw new Error("Settings row missing");
  const restartRequired = current.serverPort !== input.serverPort;

  await ensureLibraryRootSync(input.libraryRoot);

  const [updated] = await db
    .update(settings)
    .set({
      serverPort: input.serverPort,
      libraryRoot: input.libraryRoot,
      searchIntervalMinutes: input.searchIntervalMinutes,
      activeDownloaderClientId: input.activeDownloaderClientId ?? null,
      restartRequired,
    })
    .where(eq(settings.id, current.id))
    .returning();

  return updated;
}
