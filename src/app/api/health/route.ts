import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { success } from "@/lib/http/responses";
import { isJobRunnerRunning } from "@/lib/jobs/runner";
import { initServerRuntime } from "@/lib/runtime/server-init";
import { withRouteLogging } from "@/lib/logging/wide-event";

export const runtime = "nodejs";

export const GET = withRouteLogging("health#show", async (_request: NextRequest) => {
  await initServerRuntime();
  await db.query.settings.findFirst();
  return success({
    database: "ok",
    jobRunner: isJobRunnerRunning() ? "running" : "starting",
  });
});
