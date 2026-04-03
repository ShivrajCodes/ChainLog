import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getReadContract, hashLogContent } from "@/lib/contract";
import type { VerifyLogRequest, VerifyLogResponse } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: VerifyLogRequest = await req.json();
    const { recordId, logContent } = body;

    if (!recordId || !logContent) {
      return NextResponse.json({ error: "Missing recordId or logContent" }, { status: 400 });
    }

    const contract = getReadContract();
    const record = await contract.getRecord(recordId);

    const recomputedHash = hashLogContent(logContent);
    const storedHash: string = record.fileHash;
    const tampered = recomputedHash.toLowerCase() !== storedHash.toLowerCase();

    const response: VerifyLogResponse = {
      recordId,
      storedHash,
      recomputedHash,
      tampered,
      fileName: record.fileName,
      machineId: record.machineId,
      timestamp: record.timestamp.toString(),
      owner: record.owner,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}