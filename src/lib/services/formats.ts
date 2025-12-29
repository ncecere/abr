import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { formats } from "@/db/schema";
import { formatPayloadSchema } from "@/lib/validation/schemas";

export async function listFormats() {
  return db.query.formats.findMany({ orderBy: (fields, { asc }) => asc(fields.priority) });
}

export async function createFormat(payload: unknown) {
  const data = formatPayloadSchema.parse(payload);
  const [created] = await db
    .insert(formats)
    .values({
      name: data.name,
      extensions: JSON.stringify(data.extensions),
      enabled: data.enabled,
      priority: data.priority,
    })
    .returning();
  return created;
}

export async function updateFormat(id: number, payload: unknown) {
  const data = formatPayloadSchema.partial().parse(payload);
  const [updated] = await db
    .update(formats)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.extensions ? { extensions: JSON.stringify(data.extensions) } : {}),
      ...(typeof data.enabled === "boolean" ? { enabled: data.enabled } : {}),
      ...(typeof data.priority === "number" ? { priority: data.priority } : {}),
    })
    .where(eq(formats.id, id))
    .returning();
  return updated;
}

export async function deleteFormat(id: number) {
  await db.delete(formats).where(eq(formats.id, id));
}
