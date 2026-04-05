import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  startTelemetryEngine,
  getEngineStatus,
} from "@/lib/telemetryEngine";
import {
  isChainConfigured,
  assertCorrectNetwork,
} from "@/lib/contract";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isChainConfigured()) {
    try {
      await assertCorrectNetwork();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Network error";

      return NextResponse.json(
        {
          error: "Wrong network",
          details: msg,
          hint: "Use Celo Sepolia RPC: https://forno.celo-sepolia.celo-testnet.org",
        },
        { status: 400 }
      );
    }
  }

  startTelemetryEngine(session.user.email);

  return NextResponse.json({
    started: true,
    user: session.user.email,
    status: getEngineStatus(),
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getEngineStatus());
}