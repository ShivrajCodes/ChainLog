import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerManualFlush, getEngineStatus } from '@/lib/telemetryEngine';

/**
 * GET /api/telemetry/trigger
 * Returns current engine status: running, pending entries, session start time.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = getEngineStatus();
  return NextResponse.json(status);
}

/**
 * POST /api/telemetry/trigger
 * Manually flushes the current batch to Celo Sepolia immediately,
 * without waiting for the 1-minute window.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await triggerManualFlush();

    if (!result) {
      return NextResponse.json(
        { message: 'No pending entries to flush.' },
        { status: 200 },
      );
    }

    return NextResponse.json({
      message: 'Batch flushed to Celo Sepolia successfully.',
      fileName: result.fileName,
      entries: result.entries,
      hash: result.hash,
    });
  } catch (err) {
    console.error('[API] Manual flush failed:', err);
    return NextResponse.json(
      { error: 'Failed to flush batch to chain.' },
      { status: 500 },
    );
  }
}