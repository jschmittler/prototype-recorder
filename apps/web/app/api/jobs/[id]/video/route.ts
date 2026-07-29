import fs from "node:fs";
import { NextResponse } from "next/server";
import { jobArtifactPath } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const optimized = new URL(req.url).searchParams.get("optimized") === "1";
  const p = jobArtifactPath(id, optimized ? "optimized" : "video");
  if (!p || !fs.existsSync(p)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = fs.readFileSync(p);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "video/webm",
      "Content-Disposition": `attachment; filename="${id}.webm"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
