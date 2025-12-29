import { db } from "@/db/client";
import { activityEvents } from "@/db/schema";
import { ActivityType } from "@/lib/domain";

export async function emitActivity(
  type: ActivityType,
  message: string,
  bookId?: number,
) {
  await db.insert(activityEvents).values({ type, message, bookId });
}

export async function listActivity(limit = 50, cursor?: number) {
  return db.query.activityEvents.findMany({
    limit,
    where: cursor
      ? (fields, operators) => operators.lt(fields.id, cursor)
      : undefined,
    orderBy: (fields, operators) => operators.desc(fields.ts),
  });
}
