import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { downloadClients } from "@/db/schema";
import { downloadClientPayloadSchema } from "@/lib/validation/schemas";

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
