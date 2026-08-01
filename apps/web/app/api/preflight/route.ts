import { NextRequest, NextResponse } from "next/server";
import { runPreflight } from "@ptw/core";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid JSON body."] }, { status: 400 });
  }
  const result = await runPreflight(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
