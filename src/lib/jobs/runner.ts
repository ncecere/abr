import pLimit from "p-limit";
import { env } from "@/config";
import { logger } from "@/lib/logger";
import { claimDueJobs, enqueueJob, markJobFailed, markJobSucceeded } from "@/lib/jobs/queue";
import { jobHandlers } from "@/lib/jobs/handlers";
import { Job } from "@/db/schema";
import { JobType } from "@/lib/domain";

const RUNNER_KEY = Symbol.for("ebr.jobRunner");
const limit = pLimit(env.JOB_CONCURRENCY);
let runnerActive = false;

export function startJobRunner() {
  if ((globalThis as any)[RUNNER_KEY]) {
    runnerActive = true;
    return;
  }

  (globalThis as any)[RUNNER_KEY] = true;
  runnerActive = true;
  scheduleRecurringJobs();

  const tick = async () => {
    try {
      const jobs = await claimDueJobs(env.JOB_CONCURRENCY);
      await Promise.all(jobs.map((job) => limit(() => executeJob(job))));
    } catch (error) {
      logger.error({ error }, "job runner tick failed");
    } finally {
      setTimeout(tick, 2000);
    }
  };

  tick();
}

async function executeJob(job: Job) {
  const handler = jobHandlers[job.type as JobType];
  if (!handler) {
    logger.warn({ jobId: job.id, type: job.type }, "no handler for job type");
    await markJobFailed(job, `Unknown job type: ${job.type}`);
    return;
  }

  try {
    await handler(job);
    await markJobSucceeded(job);
  } catch (error) {
    logger.error({ error, job }, "job execution failed");
    await markJobFailed(job, error instanceof Error ? error.message : String(error));
  }
}

export function isJobRunnerRunning() {
  return runnerActive;
}

function scheduleRecurringJobs() {
  enqueueJob("SEARCH_MISSING_BOOKS", {});
  enqueueJob("POLL_DOWNLOADS", {});

  setInterval(() => {
    enqueueJob("SEARCH_MISSING_BOOKS", {}, new Date());
  }, env.SEARCH_INTERVAL_MINUTES * 60_000);

  setInterval(() => {
    enqueueJob("POLL_DOWNLOADS", {}, new Date());
  }, env.DOWNLOAD_POLL_INTERVAL_SECONDS * 1000);
}
