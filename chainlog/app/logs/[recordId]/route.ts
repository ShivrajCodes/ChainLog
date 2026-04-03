import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getReadContract } from "@/lib/contract";
import type { LogRecord } from "@/types";
export async function GET(
  _req: NextRequest,
  { params }: { params: { recordId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { recordId } = params;
    const contract = getReadContract();
    const rec = await contract.getRecord(recordId);
    const record: LogRecord = {
      recordId,
      fileHash: rec.fileHash,
      timestamp: rec.timestamp.toString(),
      fileName: rec.fileName,
      machineId: rec.machineId,
      owner: rec.owner,
    };
    return NextResponse.json(record);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}