import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readLedger } from "@/lib/ledger";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const ledger = await readLedger();
  const records = ledger.records || [];

  return NextResponse.json({
    records,
    total: records.length,
  });
}