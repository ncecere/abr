import { initServerRuntime } from "./src/lib/runtime/server-init";

export const runtime = "nodejs";

export async function register() {
  await initServerRuntime();
}
