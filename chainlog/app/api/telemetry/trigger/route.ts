import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { triggerManualFlush, getEngineStatus } from "@/lib/telemetryEngine";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getEngineStatus());
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let overrideEntries: unknown[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.entries)) overrideEntries = body.entries;
  } catch {}

  try {
    const result = await triggerManualFlush();
    if (!result) {
      return NextResponse.json({ message: "No pending entries to flush." });
    }
    return NextResponse.json({
      message: "Batch flushed successfully.",
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/trigger] Flush failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}