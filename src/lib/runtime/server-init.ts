import { bootstrapDatabase } from "@/lib/runtime/bootstrap";
import { startJobRunner } from "@/lib/jobs/runner";

let initialized = false;

export async function initServerRuntime() {
  if (initialized) return;
  initialized = true;
  await bootstrapDatabase();
  startJobRunner();
}
