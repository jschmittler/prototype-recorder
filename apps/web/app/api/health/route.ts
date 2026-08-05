import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Non-secret config snapshot for local debugging (is AI/recording wired up?). */
export async function GET() {
  const aiProvider = process.env.AI_PROVIDER ?? "fake";
  const openaiConfigured =
    aiProvider === "openai" && Boolean(process.env.OPENAI_API_KEY?.trim());

  return NextResponse.json({
    ok: true,
    version: process.env.APP_VERSION ?? "development",
    appMode: process.env.APP_MODE ?? "demo",
    aiProvider,
    openaiConfigured,
    executor: process.env.EXECUTOR ?? "fake",
    jobStore: process.env.JOB_STORE ?? "memory",
    queueDriver: process.env.QUEUE_DRIVER ?? "memory",
    storageDriver: process.env.STORAGE_DRIVER ?? "local",
  });
}
