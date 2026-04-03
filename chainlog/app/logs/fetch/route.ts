import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readLedger } from "@/lib/ledger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = readLedger();

  // Filter by owner (email) so each user sees only their own records
  const mine = all.filter(
    (r) => r.owner === (session.user?.email ?? "unknown")
  );

  return NextResponse.json({ records: mine, total: mine.length });
}