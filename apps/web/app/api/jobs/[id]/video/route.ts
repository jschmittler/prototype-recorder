import { NextResponse } from "next/server";
import { artifactRef, getStorage } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const optimized = url.searchParams.get("optimized") === "1";
  const inline = url.searchParams.get("inline") === "1";
  const ref = await artifactRef(id, optimized ? "optimized" : "video");
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storage = await getStorage();
  if (storage.kind === "s3") {
    return NextResponse.redirect(await storage.presignedGetUrl(ref.key, ref.filename, ref.contentType), 302);
  }
  const bytes = await storage.getBytes(ref.key);
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes.data), {
    headers: {
      "Content-Type": ref.contentType,
      ...(inline
        ? { "Cache-Control": "private, max-age=3600" }
        : {
            "Content-Disposition": `attachment; filename="${ref.filename}"`,
            "Cache-Control": "private, no-store",
          }),
      "Content-Length": String(bytes.data.byteLength),
    },
  });
}
