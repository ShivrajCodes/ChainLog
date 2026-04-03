import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hashBatch, appendRecord, makeRecordId, readLedger, writeLedger } from "@/lib/ledger";

// GET — return pending count from the running engine (server-side state)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ pending: 0, message: "Telemetry engine running via instrumentation.ts" });
}

// POST — receive a batch from the frontend and store it
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { entries, fileName } = body as {
      entries: unknown[];
      fileName: string;
    };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "No entries" }, { status: 400 });
    }

    const machineId = process.env.MACHINE_ID ?? "MOTOR-001";

    const batchPayload = {
      machineId,
      fileName,
      sessionStart: new Date().toISOString(),
      entries,
    };

    const fileHash = hashBatch(batchPayload);
    const recordId = makeRecordId(fileHash);
    const now = Date.now();

    // Save to local ledger
    appendRecord({
      recordId,
      fileName,
      fileHash,
      timestamp: now,
      machineId,
      entries: entries.length,
      owner: session.user?.email ?? "unknown",
      onChain: false,
    });

    // Try chain if ENVs are set
    let txHash: string | undefined;
    const hasEnvs =
      process.env.PRIVATE_KEY &&
      process.env.PRIVATE_KEY !== "your_wallet_private_key_here" &&
      process.env.CONTRACT_ADDRESS &&
      process.env.CONTRACT_ADDRESS !== "your_deployed_contract_address_here";

    if (hasEnvs) {
      try {
        const { getSignerContract } = await import("@/lib/contract");
        const contract = await getSignerContract();
        const bytes32Hash = "0x" + fileHash.slice(0, 64);
        const tx = await contract.storeLog(
          bytes32Hash,
          Math.floor(now / 1000),
          fileName,
          machineId
        );
        await tx.wait();
        txHash = tx.hash;

        const all = readLedger();
        const idx = all.findIndex((r) => r.recordId === recordId);
        if (idx !== -1) {
          all[idx].onChain = true;
          all[idx].txHash = txHash;
          writeLedger(all);
        }
      } catch (e) {
        console.error("[trigger] Chain tx failed:", e);
      }
    }

    return NextResponse.json({
      success: true,
      recordId,
      fileHash,
      fileName,
      entries: entries.length,
      machineId,
      onChain: !!txHash,
      txHash,
    });
  } catch (err) {
    console.error("[trigger] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}