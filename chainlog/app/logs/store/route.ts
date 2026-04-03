import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSignerContract } from '@/lib/contract';
import { generateSHA256Hash, hexToBytes32 } from '@/lib/hash';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { logContent: unknown; fileName: string; machineId: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { logContent, fileName, machineId } = body;

  if (!logContent || !fileName || !machineId) {
    return NextResponse.json(
      { error: 'logContent, fileName, and machineId are required' },
      { status: 400 },
    );
  }

  try {
    const hexHash = generateSHA256Hash(logContent);
    const bytes32Hash = hexToBytes32(hexHash);
    const timestampUnix = BigInt(Math.floor(Date.now() / 1000));

    const contract = getSignerContract();
    const tx = await contract.storeLog(bytes32Hash, timestampUnix, fileName, machineId);

    console.log(`[API/store] TX sent: ${tx.hash}`);
    await tx.wait();
    console.log(`[API/store] TX confirmed ✓`);

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      fileHash: hexHash,
      fileName,
      machineId,
    });
  } catch (err) {
    console.error('[API/store] Error:', err);
    return NextResponse.json({ error: 'Failed to store log on-chain' }, { status: 500 });
  }
}