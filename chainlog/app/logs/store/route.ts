import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hashBatch, appendRecord, makeRecordId } from "@/lib/ledger";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { entries, fileName, machineId } = body as {
      entries: unknown[];
      fileName: string;
      machineId?: string;
    };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "No entries provided" }, { status: 400 });
    }

    const batchPayload = {
      machineId: machineId ?? process.env.MACHINE_ID ?? "MOTOR-001",
      fileName,
      sessionStart: new Date().toISOString(),
      entries,
    };

    const fileHash = hashBatch(batchPayload);
    const recordId = makeRecordId(fileHash);
    const now = Date.now();

    // ── Always save to local JSON ledger ─────────────────────────────────
    appendRecord({
      recordId,
      fileName,
      fileHash,
      timestamp: now,
      machineId: batchPayload.machineId,
      entries: entries.length,
      owner: session.user?.email ?? "unknown",
      onChain: false,
    });

    // ── Optionally push to Celo Sepolia if ENV is filled ─────────────────
    let txHash: string | undefined;
    const hasEnvs =
      process.env.PRIVATE_KEY &&
      process.env.PRIVATE_KEY !== "your_wallet_private_key_here" &&
      process.env.CONTRACT_ADDRESS &&
      process.env.CONTRACT_ADDRESS !== "your_deployed_contract_address_here";

    if (hasEnvs) {
      try {
        // Dynamic import so the file doesn't crash when ENVs are missing
        const { getSignerContract } = await import("@/lib/contract");
        const contract = await getSignerContract();
        const bytes32Hash = "0x" + fileHash.slice(0, 64);
        const timestampSec = Math.floor(now / 1000);
        const tx = await contract.storeLog(
          bytes32Hash,
          timestampSec,
          fileName,
          batchPayload.machineId
        );
        await tx.wait();
        txHash = tx.hash;

        // Update ledger record as on-chain
        const { readLedger, writeLedger } = await import("@/lib/ledger");
        const all = readLedger();
        const idx = all.findIndex((r) => r.recordId === recordId);
        if (idx !== -1) {
          all[idx].onChain = true;
          all[idx].txHash = txHash;
          writeLedger(all);
        }
      } catch (chainErr) {
        console.error("[store] Chain tx failed:", chainErr);
        // Don't fail the request — still saved locally
      }
    }

    return NextResponse.json({
      success: true,
      recordId,
      fileHash,
      fileName,
      entries: entries.length,
      onChain: !!txHash,
      txHash,
    });
  } catch (err) {
    console.error("[store] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}