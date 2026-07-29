import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";

export const runtime = "nodejs";

function ownerId(req: NextRequest): string {
  return req.cookies.get("ptw_sid")?.value ?? "anon";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid JSON body."] }, { status: 400 });
  }
  const result = await createJob(body, ownerId(req));
  return NextResponse.json(result, { status: result.ok ? 201 : 422 });
}
