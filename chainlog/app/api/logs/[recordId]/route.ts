import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getReaderContract } from '@/lib/contract';

export async function GET(_req: NextRequest,{ params }: { params: { recordId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { recordId } = params;

  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  try {
    const contract = getReaderContract();
    const record = await contract.getRecord(recordId);

    return NextResponse.json({
      recordId,
      fileHash: record.fileHash,
      fileName: record.fileName,
      machineId: record.machineId,
      owner: record.owner,
      timestamp: Number(record.timestamp),
    });
  } catch (err) {
    console.error('[API/recordId] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch record' }, { status: 500 });
  }
}