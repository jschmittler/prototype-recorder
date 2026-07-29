/**
 * Redis-backed queue via BullMQ. Producer (web) calls enqueue; consumer
 * (worker) calls process to spin up a BullMQ Worker. Loaded only when
 * QUEUE_DRIVER=redis.
 */
import { Queue as BullQueue, Worker } from "bullmq";
import IORedis from "ioredis";
import type { JobHandler, Queue } from "./queue";

const QUEUE_NAME = "walkthroughs";

export class BullMqQueue implements Queue {
  readonly kind = "redis" as const;
  private connection: IORedis;
  private queue: BullQueue;
  private worker: Worker | null = null;
  private concurrency: number;

  constructor(url = process.env.REDIS_URL || "redis://localhost:6379") {
    this.connection = new IORedis(url, { maxRetriesPerRequest: null });
    this.queue = new BullQueue(QUEUE_NAME, { connection: this.connection });
    this.concurrency = Number(process.env.MAX_CONCURRENT_JOBS || 2);
  }
  async enqueue(jobId: string): Promise<void> {
    await this.queue.add("record", { jobId }, { removeOnComplete: 100, removeOnFail: 500 });
  }
  process(handler: JobHandler): void {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await handler(job.data.jobId as string);
      },
      { connection: this.connection, concurrency: this.concurrency }
    );
    this.worker.on("failed", (job, err) => console.error(`[core:queue] job ${job?.id} failed:`, err?.message));
  }
  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    this.connection.disconnect();
  }
}
