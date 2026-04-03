import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { findRecord } from "@/lib/ledger";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read the file contents as text (it should be a JSON log file)
    const text = await file.text();

    // Parse and re-stringify with the same format used when storing
    // to get a deterministic hash
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "File is not valid JSON" }, { status: 400 });
    }

    // Compute SHA-256 of the canonical JSON (same as hashBatch does)
    const canonical = JSON.stringify(parsed);
    const fileHash = crypto.createHash("sha256").update(canonical).digest("hex");

    // Look up in local ledger
    const record = findRecord(fileHash);

    if (record) {
      return NextResponse.json({
        verified: true,
        tampered: false,
        fileName: record.fileName,
        fileHash,
        storedHash: record.fileHash,
        timestamp: record.timestamp,
        machineId: record.machineId,
        entries: record.entries,
        onChain: record.onChain,
        txHash: record.txHash,
        owner: record.owner,
        message: "✅ File is authentic — hash matches the stored record.",
      });
    } else {
      // Not found in ledger — either tampered or never stored
      // Also return the hash so the user can see what was computed
      return NextResponse.json({
        verified: false,
        tampered: true,
        fileHash,
        message:
          "❌ No matching record found. This file may have been tampered with or was never stored.",
      });
    }
  } catch (err) {
    console.error("[verify] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}