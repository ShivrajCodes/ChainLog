import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSignerContract, isChainConfigured, assertCorrectNetwork } from "@/lib/contract";
import { generateSHA256Hash, hexToBytes32 } from "@/lib/hash";
import { addRecord } from "@/lib/ledger";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { logContent: unknown; fileName: string; machineId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { logContent, fileName, machineId } = body;
  if (!logContent || !fileName || !machineId) {
    return NextResponse.json(
      { error: "logContent, fileName, and machineId are required" },
      { status: 400 }
    );
  }

  const fileHash = generateSHA256Hash(logContent);
  const bytes32Hash = hexToBytes32(fileHash);
  const timestampUnix = BigInt(Math.floor(Date.now() / 1000));
  const recordId = createHash("sha256").update(fileName).digest("hex").slice(0, 32);

  let onChain = false;
  let txHash: string | undefined;

  if (isChainConfigured()) {
    try {
      await assertCorrectNetwork();
      const contract = getSignerContract();
      const tx = await contract.storeLog(bytes32Hash, timestampUnix, fileName, machineId);
      await tx.wait();
      txHash = tx.hash;
      onChain = true;
    } catch (err) {
      console.error("[API/store] Chain write failed — local only:", err);
    }
  }

  await addRecord({
    recordId,
    fileName,
    fileHash,
    timestamp: Date.now(),
    machineId,
    entries: Array.isArray((logContent as { entries?: unknown[] })?.entries)
      ? ((logContent as { entries: unknown[] }).entries).length
      : 0,
    onChain,
    txHash,
  });

  return NextResponse.json({ success: true, fileHash, fileName, machineId, onChain, txHash, recordId });
}