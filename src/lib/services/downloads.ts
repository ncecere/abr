import { db } from "@/db/client";
import type { DownloadClientPathMapping } from "@/db/schema";
import { downloads } from "@/db/schema";
import { emitActivity } from "@/lib/activity";
import { DownloaderType } from "@/lib/domain";
import { createDownloadClient } from "@/lib/downloaders";
import { applyDownloadClientPathMappings, listDownloadClientPathMappings } from "@/lib/services/download-clients";
import { enqueueJob } from "@/lib/jobs/queue";
import { desc, eq, ne } from "drizzle-orm";

export async function pollDownloadsNow() {
  const rawActive = await db
    .select()
    .from(downloads)
    .where(ne(downloads.status, "completed"))
    .orderBy(desc(downloads.id));

  const deduped: typeof rawActive = [];
  const seen = new Set<string>();
  for (const entry of rawActive) {
    const key = entry.downloaderItemId ?? String(entry.id);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  const pathMappingCache = new Map<number, DownloadClientPathMapping[]>();

  for (const download of deduped.reverse()) {
    const client = await db.query.downloadClients.findFirst({
      where: (fields, { eq }) => eq(fields.id, download.downloadClientId),
    });
    if (!client) continue;

    const adapter = createDownloadClient({
      type: client.type as DownloaderType,
      host: client.host,
      port: client.port,
      apiKey: client.apiKey ?? undefined,
      username: client.username ?? undefined,
      password: client.password ?? undefined,
      category: client.category,
    });

    const status = await adapter.getStatus(download.downloaderItemId);
    if (status.status === download.status && !status.outputPath) {
      continue;
    }

    let resolvedOutputPath = status.outputPath;
    if (status.outputPath) {
      let mappings = pathMappingCache.get(client.id);
      if (mappings === undefined) {
        mappings = await listDownloadClientPathMappings(client.id);
        pathMappingCache.set(client.id, mappings);
      }
      if (mappings.length) {
        resolvedOutputPath = applyDownloadClientPathMappings(status.outputPath, mappings);
      }
    }

    const updateWhere = download.downloaderItemId
      ? eq(downloads.downloaderItemId, download.downloaderItemId)
      : eq(downloads.id, download.id);

    await db
      .update(downloads)
      .set({ status: status.status, outputPath: resolvedOutputPath, error: status.error, updatedAt: new Date() })
      .where(updateWhere);

    if (status.status === "completed" && resolvedOutputPath) {
      await emitActivity("DOWNLOAD_COMPLETED", "Download completed", download.bookId);
      await enqueueJob("IMPORT_DOWNLOAD", { downloadId: download.id });
    }

    if (status.status === "failed") {
      await emitActivity("ERROR", status.error ?? "Download failed", download.bookId);
    }
  }
}
