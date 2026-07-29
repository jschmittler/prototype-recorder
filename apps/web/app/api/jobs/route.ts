import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";

export const runtime = "nodejs";

/** Anonymous demo owner id from a cookie (real auth arrives in a later phase). */
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
  const result = createJob(body, ownerId(req));
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result, { status: 201 });
}
