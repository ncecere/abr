import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents } from "@/db/schema";
import { success } from "@/lib/http/responses";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("activity#index", async (request: NextRequest) => {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const data = await db
    .select()
    .from(activityEvents)
    .orderBy(desc(activityEvents.ts))
    .limit(Math.min(limit, 100));
  return success(data);
});
