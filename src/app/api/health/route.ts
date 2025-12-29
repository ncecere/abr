import { db } from "@/db/client";
import { success } from "@/lib/http/responses";
import { isJobRunnerRunning } from "@/lib/jobs/runner";

export const runtime = "nodejs";

export async function GET() {
  await db.query.settings.findFirst();
  return success({
    database: "ok",
    jobRunner: isJobRunnerRunning() ? "running" : "starting",
  });
}
