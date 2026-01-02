import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { SettingsUpdateInput, SecuritySettingsInput } from "@/lib/validation/schemas";
import { ensureLibraryRootSync } from "@/lib/runtime/bootstrap";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";

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

export async function updateSecuritySettings(input: SecuritySettingsInput) {
  const current = await getSettings();
  if (!current) throw new Error("Settings row missing");

  if (input.authEnabled) {
    if (!input.username?.trim()) {
      throw new Error("Username is required when authentication is enabled");
    }
    if (!current.authPasswordHash && !input.password) {
      throw new Error("Password is required when enabling authentication");
    }
  }

  const updates: Partial<typeof settings.$inferInsert> = {
    authEnabled: input.authEnabled,
  };

  let usernameChanged = false;
  if (typeof input.username === "string") {
    const normalized = input.username.trim();
    if (!normalized) {
      throw new Error("Username cannot be empty");
    }
    updates.authUsername = normalized;
    usernameChanged = normalized !== (current.authUsername ?? "");
  }

  let passwordChanged = false;
  if (input.password) {
    updates.authPasswordHash = await hashPassword(input.password);
    passwordChanged = true;
  }

  if (input.authEnabled && !updates.authPasswordHash && !current.authPasswordHash) {
    throw new Error("Password is required when enabling authentication");
  }

  if (input.authEnabled && !current.authEnabled) {
    updates.apiKey = generateApiKey();
  }

  const [updated] = await db
    .update(settings)
    .set(updates)
    .where(eq(settings.id, current.id))
    .returning();

  let requireReauth = false;
  if (!updated.authEnabled) {
    await revokeAllSessions();
  } else if (!current.authEnabled || passwordChanged || usernameChanged) {
    requireReauth = true;
    await revokeAllSessions();
  }

  return { settings: updated, requireReauth };
}

export async function rotateApiKey() {
  const current = await getSettings();
  if (!current) throw new Error("Settings row missing");
  if (!current.authEnabled) {
    throw new Error("Enable authentication before generating an API key");
  }
  const newKey = generateApiKey();
  const [updated] = await db
    .update(settings)
    .set({ apiKey: newKey })
    .where(eq(settings.id, current.id))
    .returning();
  return updated;
}

function generateApiKey() {
  return randomBytes(24).toString("hex");
}
