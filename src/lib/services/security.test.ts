import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings as settingsTable } from "@/db/schema";
import { getSettings, rotateApiKey, updateSecuritySettings } from "@/lib/services/settings";
import { revokeAllSessions } from "@/lib/auth/session";

let originalSettings: Awaited<ReturnType<typeof getSettings>>;

beforeAll(async () => {
  originalSettings = await getSettings();
});

afterAll(async () => {
  if (originalSettings) {
    await db
      .update(settingsTable)
      .set({
        authEnabled: originalSettings.authEnabled,
        authUsername: originalSettings.authUsername,
        authPasswordHash: originalSettings.authPasswordHash,
        apiKey: originalSettings.apiKey,
      })
      .where(eq(settingsTable.id, originalSettings.id));
  }
  await revokeAllSessions();
});

describe("security settings", () => {
  it("requires a password when enabling authentication", async () => {
    const current = await getSettings();
    expect(current).toBeTruthy();
    if (!current) throw new Error("missing settings row");
    await db
      .update(settingsTable)
      .set({ authEnabled: false, authUsername: null, authPasswordHash: null, apiKey: null })
      .where(eq(settingsTable.id, current.id));

    await expect(
      updateSecuritySettings({
        authEnabled: true,
        username: "admin",
      }),
    ).rejects.toThrow(/Password is required/);
  });

  it("saves credentials and generates an API key", async () => {
    const result = await updateSecuritySettings({
      authEnabled: true,
      username: "admin",
      password: "super-secret-pass",
    });
    expect(result.settings.authEnabled).toBe(true);
    expect(result.settings.authUsername).toBe("admin");
    expect(result.settings.apiKey).toBeTruthy();
    expect(result.requireReauth).toBe(true);
  });

  it("rotates API keys on demand", async () => {
    const before = await getSettings();
    expect(before?.apiKey).toBeTruthy();
    const updated = await rotateApiKey();
    expect(updated.apiKey).toBeTruthy();
    expect(updated.apiKey).not.toBe(before?.apiKey);
  });
});
