import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { detectMultiTrackInDirectory, ensureSingleTrackBeforeImport } from "@/lib/jobs/handlers";
import type { Download } from "@/db/schema";
import { books } from "@/db/schema";

const baseDownload = {
  id: 1,
  bookId: 1,
  downloadClientId: null,
  downloadClientIntegrationId: null,
  downloadClientIdLegacy: null,
  downloaderItemId: "item-1",
  outputPath: "/tmp/download",
  status: "completed",
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Download;

const baseBook = {
  id: 1,
  audibleAsin: "ASIN",
  audibleProductId: null,
  title: "Test Book",
  authorsJson: "[]",
  narratorsJson: "[]",
  publishYear: null,
  releaseDate: null,
  description: null,
  language: null,
  runtimeSeconds: null,
  sampleUrl: null,
  coverUrl: null,
  coverPath: null,
  state: "MISSING",
  createdAt: new Date(),
  updatedAt: new Date(),
} as typeof books.$inferSelect;

describe("detectMultiTrackInDirectory", () => {
  it("returns null when only one matching file exists", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "abr-test-"));
    await fs.writeFile(path.join(tmpDir, "single.mp4"), "data");

    const result = await detectMultiTrackInDirectory(tmpDir);
    expect(result).toBeNull();
  });

  it("returns dominant extension when multiple tracks exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "abr-test-"));
    await fs.writeFile(path.join(tmpDir, "01.mp4"), "data");
    await fs.writeFile(path.join(tmpDir, "02.mp4"), "data");
    await fs.writeFile(path.join(tmpDir, "extra.mp3"), "data");

    const result = await detectMultiTrackInDirectory(tmpDir);
    expect(result).not.toBeNull();
    expect(result?.extension).toBe("mp4");
    expect(result?.files.length).toBe(2);
    expect(result?.files[0]).toContain("01.mp4");
    expect(result?.files[1]).toContain("02.mp4");
  });
});

describe("ensureSingleTrackBeforeImport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when no multi-track release is detected", async () => {
    const detectMock = vi.fn().mockResolvedValue(null);
    const scheduleMock = vi.fn();

    const result = await ensureSingleTrackBeforeImport(baseDownload, baseBook, "/tmp/download", {
      detect: detectMock,
      schedule: scheduleMock,
    });
    expect(result).toBe(false);
    expect(detectMock).toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("queues merge when multi-track release is detected", async () => {
    const detectMock = vi.fn().mockResolvedValue({ files: ["/tmp/01.mp4", "/tmp/02.mp4"], extension: "mp4" });
    const scheduleMock = vi.fn().mockResolvedValue(undefined);

    const result = await ensureSingleTrackBeforeImport(baseDownload, baseBook, "/tmp/download", {
      detect: detectMock,
      schedule: scheduleMock,
    });
    expect(result).toBe(true);
    expect(detectMock).toHaveBeenCalled();
    expect(scheduleMock).toHaveBeenCalledTimes(1);
  });
});
