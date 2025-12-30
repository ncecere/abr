import { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents, books } from "@/db/schema";

export const metadata: Metadata = {
  title: "EBR · Activity",
};

export default async function ActivityPage() {
  const events = await db
    .select({
      id: activityEvents.id,
      ts: activityEvents.ts,
      type: activityEvents.type,
      message: activityEvents.message,
      bookId: activityEvents.bookId,
      title: books.title,
    })
    .from(activityEvents)
    .leftJoin(books, eq(activityEvents.bookId, books.id))
    .orderBy(desc(activityEvents.ts))
    .limit(50);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-muted-foreground text-sm">Recent automation events.</p>
      </div>
      <div className="space-y-4">
        {events.map((event) => {
          const dateValue = event.ts ? new Date(event.ts) : null;
          const formatted = dateValue && !Number.isNaN(dateValue.valueOf()) ? dateValue.toLocaleString() : "Recently";
          return (
            <div key={event.id} className="border-l-2 border-primary pl-4">
              <p className="text-xs text-muted-foreground">
                {formatted} · {event.type}
              </p>
              <p className="text-sm font-medium">{event.message}</p>
              {event.title && <p className="text-sm text-muted-foreground">{event.title}</p>}
            </div>
          );
        })}
        {events.length === 0 && <p className="text-muted-foreground">No events yet.</p>}
      </div>
    </section>
  );
}
