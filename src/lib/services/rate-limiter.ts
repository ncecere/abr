import PQueue from "p-queue";

export class RateLimiter {
  private readonly queue: PQueue;

  constructor(intervalCap: number, interval: number) {
    this.queue = new PQueue({
      intervalCap,
      interval,
      carryoverConcurrencyCount: true,
    });
  }

  schedule<T>(fn: () => Promise<T>) {
    return this.queue.add(fn);
  }
}
