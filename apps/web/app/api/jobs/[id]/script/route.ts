import fs from "node:fs";
import { NextResponse } from "next/server";
import { jobArtifactPath } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = jobArtifactPath(id, "script");
  if (!p || !fs.existsSync(p)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const text = fs.readFileSync(p, "utf8");
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}.md"`,
      "Cache-Control": "private, no-store",
    },
  });
}
