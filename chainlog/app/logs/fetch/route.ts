import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getReaderContract } from '@/lib/contract';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contract = getReaderContract();
    const recordIds: string[] = await contract.getMyRecords();

    const records = await Promise.all(
      recordIds.map(async (id) => {
        const record = await contract.getRecord(id);
        return {
          recordId: id,
          fileHash: record.fileHash,
          fileName: record.fileName,
          machineId: record.machineId,
          owner: record.owner,
          timestamp: Number(record.timestamp),
        };
      }),
    );

    return NextResponse.json({ records });
  } catch (err) {
    console.error('[API/fetch] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}