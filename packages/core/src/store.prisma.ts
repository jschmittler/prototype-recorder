/**
 * Postgres JobStore via Prisma. The full Job is stored as a JSON `data` column
 * with a few indexed columns (id, ownerId, status, idempotencyKey, createdAt).
 * Loaded only when JOB_STORE=postgres. Run `npm run db:migrate` first.
 */
import { PrismaClient } from "@prisma/client";
import type { Job } from "@ptw/job-contracts";
import type { CreateOpts, JobStore } from "./store";

export class PrismaJobStore implements JobStore {
  readonly kind = "postgres" as const;
  private prisma: PrismaClient;
  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }
  async create(job: Job, opts?: CreateOpts): Promise<Job> {
    await this.prisma.job.create({
      data: {
        id: job.id,
        ownerId: job.ownerId,
        status: job.status,
        idempotencyKey: opts?.idempotencyKey ?? null,
        createdAt: new Date(job.createdAt),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: job as any,
      },
    });
    return job;
  }
  async get(id: string): Promise<Job | null> {
    const row = await this.prisma.job.findUnique({ where: { id } });
    return row ? (row.data as unknown as Job) : null;
  }
  async update(id: string, patch: Partial<Job>): Promise<Job> {
    const cur = await this.get(id);
    if (!cur) throw new Error(`Job not found: ${id}`);
    const next = { ...cur, ...patch };
    await this.prisma.job.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: next.status, data: next as any },
    });
    return next;
  }
  async listForOwner(ownerId: string, limit = 50): Promise<Job[]> {
    const rows = await this.prisma.job.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => r.data as unknown as Job);
  }
  async findByIdempotency(ownerId: string, key: string): Promise<Job | null> {
    const row = await this.prisma.job.findFirst({ where: { ownerId, idempotencyKey: key } });
    return row ? (row.data as unknown as Job) : null;
  }
}
