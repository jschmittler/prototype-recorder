/** Queue abstraction + in-process implementation (dev/default). */
export type JobHandler = (jobId: string) => Promise<void>;

export interface Queue {
  readonly kind: "inproc" | "redis";
  enqueue(jobId: string): Promise<void>;
  process(handler: JobHandler): void | Promise<void>;
  close(): Promise<void>;
}

/** Runs the handler in the same process, right after enqueue. */
export class InProcessQueue implements Queue {
  readonly kind = "inproc" as const;
  private handler: JobHandler | null = null;
  process(handler: JobHandler): void {
    this.handler = handler;
  }
  async enqueue(jobId: string): Promise<void> {
    const h = this.handler;
    if (!h) return;
    setImmediate(() => {
      void h(jobId).catch((e) => console.error(`[core:queue] job ${jobId} failed:`, e));
    });
  }
  async close(): Promise<void> {}
}
