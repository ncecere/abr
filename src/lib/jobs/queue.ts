import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";
import { Job } from "@/db/schema";
import { JobPayload } from "@/lib/jobs/types";
import { JobType } from "@/lib/domain";

export async function enqueueJob<TType extends JobType>(
  type: TType,
  payload: JobPayload<TType>,
  runAt = new Date(),
) {
  await db.insert(jobs).values({
    type,
    payload: JSON.stringify(payload),
    runAt,
  });
}

export async function claimDueJobs(limit: number) {
  const now = new Date();
  const due = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, now)))
    .orderBy(asc(jobs.runAt))
    .limit(limit);

  const claimed: Job[] = [];

  for (const job of due) {
    const [updated] = await db
      .update(jobs)
      .set({ status: "running", attempts: job.attempts + 1, updatedAt: new Date() })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "queued")))
      .returning();

    if (updated) {
      claimed.push({ ...job, status: "running", attempts: updated.attempts });
    }
  }

  return claimed;
}

export async function markJobSucceeded(job: Job) {
  await db.update(jobs).set({ status: "succeeded", updatedAt: new Date() }).where(eq(jobs.id, job.id));
}

export async function markJobFailed(job: Job, error: string) {
  const attempts = job.attempts + 1;
  const shouldRetry = attempts < 3;
  await db
    .update(jobs)
    .set({
      status: shouldRetry ? "queued" : "failed",
      attempts,
      lastError: error,
      runAt: shouldRetry ? new Date(Date.now() + 60_000) : job.runAt,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
}
