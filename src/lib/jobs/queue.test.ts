import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";
import { claimDueJobs } from "@/lib/jobs/queue";

describe("claimDueJobs", () => {
  beforeEach(async () => {
    await db.delete(jobs);
  });

  it("only claims queued jobs once", async () => {
    const [job] = await db
      .insert(jobs)
      .values({
        type: "SEARCH_BOOK",
        payload: JSON.stringify({ bookId: 1 }),
        status: "queued",
        runAt: new Date(Date.now() - 1_000),
      })
      .returning();

    const firstClaim = await claimDueJobs(1);
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0].id).toBe(job.id);

    const dbJob = await db.query.jobs.findFirst({ where: (fields, { eq }) => eq(fields.id, job.id) });
    expect(dbJob?.status).toBe("running");

    const secondClaim = await claimDueJobs(1);
    expect(secondClaim).toHaveLength(0);
  });
});
