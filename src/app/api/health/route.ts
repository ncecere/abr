import { db } from "@/db/client";
import { success } from "@/lib/http/responses";
import { isJobRunnerRunning } from "@/lib/jobs/runner";
import { initServerRuntime } from "@/lib/runtime/server-init";

export const runtime = "nodejs";

export async function GET() {
  await initServerRuntime();
  await db.query.settings.findFirst();
  return success({
    database: "ok",
    jobRunner: isJobRunnerRunning() ? "running" : "starting",
  });
}
