/**
 * Asynchronous job worker. Consumes the queue and runs the shared pipeline.
 * With QUEUE_DRIVER=redis it starts a BullMQ worker (Chromium/FFmpeg run here
 * via the engine adapter); the JOB_STORE / STORAGE_DRIVER env vars select the
 * real Postgres + S3 adapters. Run: `npm run start -w @ptw/worker`.
 */
import { startWorker, log } from "@ptw/core";

async function main(): Promise<void> {
  await startWorker();
  log("worker", "started; waiting for jobs (Ctrl-C to stop)");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log("worker", `received ${sig}, exiting`);
    process.exit(0);
  });
}
