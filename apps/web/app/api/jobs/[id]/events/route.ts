import type { NextRequest } from "next/server";
import { getPublicJob, subscribe } from "@/lib/jobs";
import { isTerminal, type JobEvent } from "@ptw/job-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-Sent Events stream of job status/log/done/error events. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let unsubscribe: () => void = () => {};
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      };
      const send = (ev: JobEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

      const current = getPublicJob(id);
      if (!current) {
        controller.enqueue(encoder.encode(`event: notfound\ndata: {}\n\n`));
        controller.close();
        return;
      }

      // Replay current state immediately.
      send({
        type: "status",
        status: current.status,
        progress: current.progress,
        stageLabel: current.stageLabel,
        stageMessage: current.stageMessage,
        at: new Date().toISOString(),
      });

      // If already finished, emit terminal event and close.
      if (isTerminal(current.status)) {
        send(
          current.status === "COMPLETED"
            ? { type: "done", job: current, at: new Date().toISOString() }
            : { type: "error", category: current.errorCategory ?? "UNKNOWN", at: new Date().toISOString() }
        );
        controller.close();
        return;
      }

      unsubscribe = subscribe(id, (ev) => {
        send(ev);
        if (ev.type === "done" || ev.type === "error") close();
      });

      heartbeat = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 15000);
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
