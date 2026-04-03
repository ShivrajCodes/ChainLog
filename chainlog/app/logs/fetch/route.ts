import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSignerContract, getReadContract } from "@/lib/contract";
import type { LogRecord } from "@/types";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const signerContract = getSignerContract();
    const recordIds: string[] = await signerContract.getMyRecords();
    const readContract = getReadContract();
    const records: LogRecord[] = await Promise.all(
      recordIds.map(async (id) => {
        const rec = await readContract.getRecord(id);
        return {
          recordId: id,
          fileHash: rec.fileHash,
          timestamp: rec.timestamp.toString(),
          fileName: rec.fileName,
          machineId: rec.machineId,
          owner: rec.owner,
        };
      })
    );
    return NextResponse.json({ records });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}