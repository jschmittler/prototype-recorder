import { NextResponse } from "next/server";
import { artifactRef, getStorage } from "@/lib/jobs";

export const runtime = "nodejs";

/** Poster frame for a finished walkthrough, used as the recent-work thumbnail. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ref = await artifactRef(id, "poster");
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
      // Immutable for the lifetime of the job: a poster never changes once written.
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Length": String(bytes.data.byteLength),
    },
  });
}
