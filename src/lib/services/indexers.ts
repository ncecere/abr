import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { indexers } from "@/db/schema";
import { indexerPayloadSchema } from "@/lib/validation/schemas";

export async function listIndexers() {
  return db.query.indexers.findMany({ orderBy: (fields, { asc }) => asc(fields.priority) });
}

export async function createIndexer(payload: unknown) {
  const data = indexerPayloadSchema.parse(payload);
  const [created] = await db
    .insert(indexers)
    .values({
      name: data.name,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      categories: JSON.stringify(data.categories),
      enabled: data.enabled,
      priority: data.priority,
    })
    .returning();
  return created;
}

export async function updateIndexer(id: number, payload: unknown) {
  const data = indexerPayloadSchema.partial().parse(payload);
  const [updated] = await db
    .update(indexers)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.baseUrl ? { baseUrl: data.baseUrl } : {}),
      ...(data.apiKey ? { apiKey: data.apiKey } : {}),
      ...(data.categories ? { categories: JSON.stringify(data.categories) } : {}),
      ...(typeof data.enabled === "boolean" ? { enabled: data.enabled } : {}),
      ...(typeof data.priority === "number" ? { priority: data.priority } : {}),
    })
    .where(eq(indexers.id, id))
    .returning();
  return updated;
}

export async function deleteIndexer(id: number) {
  await db.delete(indexers).where(eq(indexers.id, id));
}
