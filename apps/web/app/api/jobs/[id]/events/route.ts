import type { NextRequest } from "next/server";
import { getServerJob } from "@/lib/jobs";
import { isTerminal, toPublicJob, type JobEvent } from "@ptw/job-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE by polling the JobStore — works whether the pipeline runs in-process or
 *  in a separate worker (which persists status/logs to the shared store). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();
  const at = () => new Date().toISOString();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let lastStatus = "";
      let lastProgress = -1;
      let lastLogLen = 0;
      const send = (ev: JobEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        controller.close();
      };
      const tick = async () => {
        if (closed) return;
        const job = await getServerJob(id);
        if (!job) {
          controller.enqueue(encoder.encode(`event: notfound\ndata: {}\n\n`));
          close();
          return;
        }
        const pub = toPublicJob(job);
        if (pub.status !== lastStatus || pub.progress !== lastProgress) {
          lastStatus = pub.status;
          lastProgress = pub.progress;
          send({ type: "status", status: pub.status, progress: pub.progress, stageLabel: pub.stageLabel, stageMessage: pub.stageMessage, at: at() });
        }
        const logs = job.logTail ?? [];
        if (logs.length > lastLogLen) {
          for (const line of logs.slice(lastLogLen)) send({ type: "log", line, at: at() });
          lastLogLen = logs.length;
        }
        if (isTerminal(pub.status)) {
          if (pub.status === "COMPLETED") send({ type: "done", job: pub, at: at() });
          else send({ type: "error", category: pub.errorCategory ?? "UNKNOWN", at: at() });
          close();
        }
      };
      void tick();
      timer = setInterval(() => void tick(), 800);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
