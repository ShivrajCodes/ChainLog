import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getReaderContract } from '@/lib/contract';
import { generateSHA256Hash, hexToBytes32 } from '@/lib/hash';
import { ethers } from 'ethers';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { recordId: string; logContent: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { recordId, logContent } = body;

  if (!recordId || !logContent) {
    return NextResponse.json(
      { error: 'recordId and logContent are required' },
      { status: 400 },
    );
  }

  try {
    const contract = getReaderContract();
    const record = await contract.getRecord(recordId);

    const onChainHash: string = record.fileHash;

    const currentHexHash = generateSHA256Hash(logContent);
    const currentBytes32Hash = hexToBytes32(currentHexHash);

    const tampered = onChainHash.toLowerCase() !== currentBytes32Hash.toLowerCase();

    return NextResponse.json({
      tampered,
      onChainHash,
      currentHash: currentBytes32Hash,
      record: {
        fileName: record.fileName,
        machineId: record.machineId,
        owner: record.owner,
        timestamp: Number(record.timestamp),
      },
    });
  } catch (err) {
    console.error('[API/verify] Error:', err);
    return NextResponse.json({ error: 'Failed to verify log' }, { status: 500 });
  }
}