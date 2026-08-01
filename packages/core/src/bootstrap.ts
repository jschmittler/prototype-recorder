/**
 * Composition root: selects JobStore / Queue / Storage from the environment and
 * exposes the operations the web (BFF) and worker call. Prod adapters are
 * imported lazily so the default (memory/inproc/local) build stays light.
 */
import { randomUUID } from "node:crypto";
import {
  CreateJobInputSchema,
  STATUS_PROGRESS,
  toPublicJob,
  type CreateJobInput,
  type Job,
  type PublicJob,
} from "@ptw/job-contracts";
import { MemoryJobStore, type JobStore } from "./store";
import { InProcessQueue, type JobHandler, type Queue } from "./queue";
import { LocalStorage, type Storage } from "./storage";
import { checkUrl } from "./ssrf";
import { runPipeline } from "./pipeline";
import { log } from "./config";

/**
 * Singletons are pinned on globalThis so that Next.js's per-route bundling
 * (which can duplicate this module) still shares ONE in-memory store/queue.
 */
interface Registry {
  store?: Promise<JobStore>;
  storage?: Promise<Storage>;
  queue?: Promise<Queue>;
  consumer?: boolean;
}
const reg: Registry = ((globalThis as unknown as { __ptwReg?: Registry }).__ptwReg ??= {});

export function getStore(): Promise<JobStore> {
  if (!reg.store)
    reg.store = (async () => {
      if ((process.env.JOB_STORE ?? "memory") === "postgres") {
        const { PrismaJobStore } = await import("./store.prisma");
        log("bootstrap", "JobStore = postgres");
        return new PrismaJobStore();
      }
      log("bootstrap", "JobStore = memory");
      return new MemoryJobStore();
    })();
  return reg.store;
}

export function getStorage(): Promise<Storage> {
  if (!reg.storage)
    reg.storage = (async () => {
      if ((process.env.STORAGE_DRIVER ?? "local") === "s3") {
        const { S3Storage } = await import("./storage.s3");
        log("bootstrap", "Storage = s3");
        return new S3Storage();
      }
      log("bootstrap", "Storage = local");
      return new LocalStorage();
    })();
  return reg.storage;
}

export function getQueue(): Promise<Queue> {
  if (!reg.queue)
    reg.queue = (async () => {
      if ((process.env.QUEUE_DRIVER ?? "memory") === "redis") {
        const { BullMqQueue } = await import("./queue.bullmq");
        log("bootstrap", "Queue = redis (BullMQ)");
        return new BullMqQueue();
      }
      log("bootstrap", "Queue = in-process");
      return new InProcessQueue();
    })();
  return reg.queue;
}

const handler: JobHandler = async (id) =>
  runPipeline(id, { store: await getStore(), storage: await getStorage() });

/** Called by the worker process to start consuming (any driver). */
export async function startWorker(): Promise<void> {
  const q = await getQueue();
  q.process(handler);
  reg.consumer = true;
  log("bootstrap", `worker consuming (${q.kind})`);
}

/** For the in-process driver, the web itself must consume — register once. */
async function ensureConsumer(): Promise<void> {
  const q = await getQueue();
  if (q.kind === "inproc" && !reg.consumer) {
    q.process(handler);
    reg.consumer = true;
  }
}

export interface CreateResult {
  ok: boolean;
  job?: PublicJob;
  errors?: string[];
}

export async function createJob(raw: unknown, ownerId: string): Promise<CreateResult> {
  const parsed = CreateJobInputSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const input: CreateJobInput = parsed.data;

  const allowlist = (process.env.URL_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
  const urlCheck = checkUrl(input.url, allowlist);
  if (!urlCheck.ok) return { ok: false, errors: [urlCheck.reason ?? "URL is not allowed."] };

  const store = await getStore();
  if (input.idempotencyKey) {
    const existing = await store.findByIdempotency(ownerId, input.idempotencyKey);
    if (existing) return { ok: true, job: toPublicJob(existing) };
  }

  const id = randomUUID();
  const job: Job = {
    id,
    ownerId,
    status: "QUEUED",
    progress: STATUS_PROGRESS.QUEUED,
    url: input.url,
    instructions: input.instructions,
    settings: input.settings,
    ...(input.script ? { scriptOverride: input.script } : {}),
    artifacts: {},
    metrics: {},
    createdAt: new Date().toISOString(),
    retryCount: 0,
    logTail: [],
  };
  await store.create(job, { idempotencyKey: input.idempotencyKey });
  await ensureConsumer();
  await (await getQueue()).enqueue(id);
  return { ok: true, job: toPublicJob(job) };
}

export async function getPublicJob(id: string, ownerId?: string): Promise<PublicJob | null> {
  const j = await (await getStore()).get(id);
  if (!j) return null;
  if (ownerId && j.ownerId !== ownerId) return null;
  return toPublicJob(j);
}

/** Full job (server-only) — used by the SSE endpoint to stream log lines. */
export async function getServerJob(id: string): Promise<Job | null> {
  return (await getStore()).get(id);
}

export interface ArtifactRef {
  key: string;
  contentType: string;
  filename: string;
}

export async function artifactRef(
  id: string,
  kind: "video" | "optimized" | "script" | "poster",
  ownerId?: string
): Promise<ArtifactRef | null> {
  const j = await (await getStore()).get(id);
  if (!j) return null;
  if (ownerId && j.ownerId !== ownerId) return null;
  const a = j.artifacts;
  if (kind === "video" && a.videoKey) return { key: a.videoKey, contentType: "video/webm", filename: `${id}.webm` };
  if (kind === "optimized" && a.optimizedVideoKey)
    return { key: a.optimizedVideoKey, contentType: "video/webm", filename: `${id}.vp9.webm` };
  if (kind === "script" && a.scriptKey)
    return { key: a.scriptKey, contentType: "text/markdown; charset=utf-8", filename: `${id}.md` };
  if (kind === "poster" && a.posterKey)
    return { key: a.posterKey, contentType: "image/jpeg", filename: `${id}.jpg` };
  return null;
}
