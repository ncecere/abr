import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { downloadClients, downloadClientPathMappings, DownloadClientPathMapping } from "@/db/schema";
import { downloadClientPayloadSchema, downloadClientPathMappingSchema } from "@/lib/validation/schemas";

export async function listDownloadClients() {
  return db.query.downloadClients.findMany({ orderBy: (fields, { asc }) => asc(fields.name) });
}

export async function createDownloadClient(payload: unknown) {
  const data = downloadClientPayloadSchema.parse(payload);
  const [created] = await db
    .insert(downloadClients)
    .values({
      name: data.name,
      type: data.type,
      host: data.host,
      port: data.port,
      apiKey: data.apiKey,
      username: data.username,
      password: data.password,
      category: data.category,
      enabled: data.enabled,
    })
    .returning();
  return created;
}

export async function updateDownloadClient(id: number, payload: unknown) {
  const data = downloadClientPayloadSchema.partial().parse(payload);
  const [updated] = await db
    .update(downloadClients)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.host ? { host: data.host } : {}),
      ...(typeof data.port === "number" ? { port: data.port } : {}),
      ...(data.apiKey ? { apiKey: data.apiKey } : {}),
      ...(data.username ? { username: data.username } : {}),
      ...(data.password ? { password: data.password } : {}),
      ...(data.category ? { category: data.category } : {}),
      ...(typeof data.enabled === "boolean" ? { enabled: data.enabled } : {}),
    })
    .where(eq(downloadClients.id, id))
    .returning();
  return updated;
}

export async function deleteDownloadClient(id: number) {
  await db.delete(downloadClients).where(eq(downloadClients.id, id));
}

export async function listDownloadClientPathMappings(downloadClientId: number) {
  return db.query.downloadClientPathMappings.findMany({
    where: (fields, { eq }) => eq(fields.downloadClientId, downloadClientId),
    orderBy: (fields, { asc }) => asc(fields.remotePath),
  });
}

export async function createDownloadClientPathMapping(downloadClientId: number, payload: unknown) {
  const data = downloadClientPathMappingSchema.parse(payload);
  const [created] = await db
    .insert(downloadClientPathMappings)
    .values({
      downloadClientId,
      remotePath: data.remotePath.trim(),
      localPath: data.localPath.trim(),
    })
    .returning();
  return created;
}

export async function updateDownloadClientPathMapping(id: number, payload: unknown) {
  const data = downloadClientPathMappingSchema.partial().parse(payload);
  const [updated] = await db
    .update(downloadClientPathMappings)
    .set({
      ...(typeof data.downloadClientId === "number" ? { downloadClientId: data.downloadClientId } : {}),
      ...(data.remotePath ? { remotePath: data.remotePath.trim() } : {}),
      ...(data.localPath ? { localPath: data.localPath.trim() } : {}),
    })
    .where(eq(downloadClientPathMappings.id, id))
    .returning();
  return updated;
}

export async function deleteDownloadClientPathMapping(id: number) {
  await db.delete(downloadClientPathMappings).where(eq(downloadClientPathMappings.id, id));
}

export function applyDownloadClientPathMappings(
  remotePath: string,
  mappings: DownloadClientPathMapping[],
) {
  if (!remotePath || !mappings.length) {
    return remotePath;
  }
  const normalizedRemote = normalizePath(remotePath);
  const ordered = [...mappings].sort((a, b) => b.remotePath.length - a.remotePath.length);
  for (const mapping of ordered) {
    const normalizedMapping = normalizePath(mapping.remotePath);
    if (
      normalizedRemote === normalizedMapping ||
      normalizedRemote.startsWith(`${normalizedMapping}/`)
    ) {
      const remainder = normalizedRemote.slice(normalizedMapping.length).replace(/^\/+/, "");
      if (!remainder) {
        return mapping.localPath;
      }
      const segments = remainder.split("/").filter(Boolean);
      return path.join(mapping.localPath, ...segments);
    }
  }
  return remotePath;
}

function normalizePath(value: string) {
  return value.replace(/\\+/g, "/").replace(/\/+/g, "/").replace(/\/+$/, "");
}
