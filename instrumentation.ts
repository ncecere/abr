import { initServerRuntime } from "./src/lib/runtime/server-init";

export async function register() {
  await initServerRuntime();
}
