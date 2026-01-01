import pLimit from "p-limit";
import { env } from "@/config";
import { logger } from "@/lib/logger";
import { claimDueJobs, enqueueJob, markJobFailed, markJobSucceeded } from "@/lib/jobs/queue";
import { jobHandlers } from "@/lib/jobs/handlers";
import { Job } from "@/db/schema";
import { JobType } from "@/lib/domain";
import { logJobEvent } from "@/lib/logging/wide-event";

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
  logger.info("job runner started");
  scheduleRecurringJobs();

  const tick = async () => {
    try {
      const jobs = await claimDueJobs(env.JOB_CONCURRENCY);
      if (jobs.length) {
        logger.info({ count: jobs.length }, "processing queued jobs");
      }
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

  const startedAt = process.hrtime();
  try {
    await handler(job);
    await markJobSucceeded(job);
    logJobEvent({ job, durationMs: elapsedMs(startedAt), outcome: "success" });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ error: err, job }, "job execution failed");
    await markJobFailed(job, err.message);
    logJobEvent({ job, durationMs: elapsedMs(startedAt), outcome: "error", error: err });
  }
}

export function isJobRunnerRunning() {
  return runnerActive;
}

function scheduleRecurringJobs() {
  logger.info("scheduling recurring jobs");
  enqueueJob("SEARCH_MISSING_BOOKS", {});
  enqueueJob("POLL_DOWNLOADS", {});

  setInterval(() => {
    logger.info("queueing SEARCH_MISSING_BOOKS job");
    enqueueJob("SEARCH_MISSING_BOOKS", {}, new Date());
  }, env.SEARCH_INTERVAL_MINUTES * 60_000);

  setInterval(() => {
    logger.info("queueing POLL_DOWNLOADS job");
    enqueueJob("POLL_DOWNLOADS", {}, new Date());
  }, env.DOWNLOAD_POLL_INTERVAL_SECONDS * 1000);
}

function elapsedMs(start: [number, number]) {
  const diff = process.hrtime(start);
  return diff[0] * 1000 + diff[1] / 1_000_000;
}
