import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSignerContract, hashLogContent } from "@/lib/contract";
import type { StoreLogRequest, StoreLogResponse } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: StoreLogRequest = await req.json();
    const { logContent, fileName, machineId, timestamp } = body;

    if (!logContent || !fileName || !machineId || !timestamp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fileHash = hashLogContent(logContent);
    const contract = getSignerContract();
    const tx = await contract.storeLog(fileHash, BigInt(timestamp), fileName, machineId);
    const receipt = await tx.wait();

    const response: StoreLogResponse = {
      success: true,
      txHash: receipt.hash,
      fileHash,
      timestamp,
      fileName,
      machineId,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}