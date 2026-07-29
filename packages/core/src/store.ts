/** JobStore abstraction + in-memory implementation (dev/default). */
import type { Job } from "@ptw/job-contracts";

export interface CreateOpts {
  idempotencyKey?: string;
}

export interface JobStore {
  readonly kind: "memory" | "postgres";
  create(job: Job, opts?: CreateOpts): Promise<Job>;
  get(id: string): Promise<Job | null>;
  update(id: string, patch: Partial<Job>): Promise<Job>;
  listForOwner(ownerId: string, limit?: number): Promise<Job[]>;
  findByIdempotency(ownerId: string, key: string): Promise<Job | null>;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class MemoryJobStore implements JobStore {
  readonly kind = "memory" as const;
  private jobs = new Map<string, Job>();
  private idem = new Map<string, string>();

  async create(job: Job, opts?: CreateOpts): Promise<Job> {
    this.jobs.set(job.id, clone(job));
    if (opts?.idempotencyKey) this.idem.set(`${job.ownerId}:${opts.idempotencyKey}`, job.id);
    return clone(job);
  }
  async get(id: string): Promise<Job | null> {
    const j = this.jobs.get(id);
    return j ? clone(j) : null;
  }
  async update(id: string, patch: Partial<Job>): Promise<Job> {
    const cur = this.jobs.get(id);
    if (!cur) throw new Error(`Job not found: ${id}`);
    const next = { ...cur, ...patch };
    this.jobs.set(id, next);
    return clone(next);
  }
  async listForOwner(ownerId: string, limit = 50): Promise<Job[]> {
    return [...this.jobs.values()]
      .filter((j) => j.ownerId === ownerId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }
  async findByIdempotency(ownerId: string, key: string): Promise<Job | null> {
    const id = this.idem.get(`${ownerId}:${key}`);
    return id ? this.get(id) : null;
  }
}
