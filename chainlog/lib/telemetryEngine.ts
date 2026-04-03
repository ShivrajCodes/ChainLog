import { ethers } from 'ethers';
import { getTelemetryEntry, TelemetryEntry } from '@/lib/telemetry';
import { generateSHA256Hash, hexToBytes32 } from '@/lib/hash';
import { getSignerContract } from '@/lib/contract';

const ENTRY_INTERVAL_MS = 3_000;
const BATCH_INTERVAL_MS = 60_000;

export interface TelemetryBatch {
  machineId: string;
  fileName: string;
  sessionStart: string;
  entries: TelemetryEntry[];
}

let entryTimer: NodeJS.Timeout | null = null;
let batchTimer: NodeJS.Timeout | null = null;
let isRunning = false;

let currentBatch: TelemetryEntry[] = [];
let lastEntry: TelemetryEntry | undefined = undefined;
let batchSessionStart: string = new Date().toISOString();

function generateFileName(isoTimestamp: string): string {
  const safe = isoTimestamp.replace(/\.\d{3}Z$/, '').replace(/:/g, '-');
  return `log-${safe}.json`;
}

async function flushBatchToChain(): Promise<void> {
  if (currentBatch.length === 0) {
    console.log('[ChainLog] No entries to flush, skipping.');
    return;
  }

  const machineId = process.env.MACHINE_ID ?? 'MOTOR-001';
  const sessionStart = batchSessionStart;
  const fileName = generateFileName(sessionStart);

  const batch: TelemetryBatch = {
    machineId,
    fileName,
    sessionStart,
    entries: [...currentBatch],
  };

  const hexHash = generateSHA256Hash(batch);
  const bytes32Hash = hexToBytes32(hexHash);

  const timestampUnix = BigInt(Math.floor(new Date(sessionStart).getTime() / 1000));

  console.log(`[ChainLog] Flushing batch: ${fileName}`);
  console.log(`[ChainLog]   Entries: ${batch.entries.length}`);
  console.log(`[ChainLog]   SHA-256: ${hexHash}`);

  try {
    const contract = getSignerContract();
    const tx = await contract.storeLog(bytes32Hash,timestampUnix,fileName,machineId);
    console.log(`[ChainLog] TX sent: ${tx.hash}`);
    await tx.wait();
    console.log(`[ChainLog] TX confirmed on Celo Sepolia ✓`);
  } catch (err) {
    console.error('[ChainLog] Failed to store batch on-chain:', err);
  }

  currentBatch = [];
  batchSessionStart = new Date().toISOString();
}

export function startTelemetryEngine(): void {
  if (isRunning) {
    console.log('[ChainLog] Telemetry engine already running.');
    return;
  }

  isRunning = true;
  batchSessionStart = new Date().toISOString();
  console.log('[ChainLog] Telemetry engine started.');

  entryTimer = setInterval(() => {
    const entry = getTelemetryEntry(lastEntry);
    lastEntry = entry;
    currentBatch.push(entry);
    console.log(`[ChainLog] Entry collected — temp: ${entry.temperature}°C | rpm: ${entry.rpm} | vib: ${entry.vibration} | health: ${entry.health}`);
  }, ENTRY_INTERVAL_MS);

  batchTimer = setInterval(() => {
    flushBatchToChain().catch(console.error);
  }, BATCH_INTERVAL_MS);
}

export async function stopTelemetryEngine(): Promise<void> {
  if (!isRunning) return;

  if (entryTimer) clearInterval(entryTimer);
  if (batchTimer) clearInterval(batchTimer);

  entryTimer = null;
  batchTimer = null;
  isRunning = false;

  console.log('[ChainLog] Flushing final batch before stop...');
  await flushBatchToChain();
  console.log('[ChainLog] Telemetry engine stopped.');
}

export async function triggerManualFlush(): Promise<{ fileName: string; entries: number; hash: string } | null> {
  if (currentBatch.length === 0) return null;

  const machineId = process.env.MACHINE_ID ?? 'MOTOR-001';
  const sessionStart = batchSessionStart;
  const fileName = generateFileName(sessionStart);

  const batch: TelemetryBatch = {
    machineId,
    fileName,
    sessionStart,
    entries: [...currentBatch],
  };

  const hexHash = generateSHA256Hash(batch);
  const bytes32Hash = hexToBytes32(hexHash);
  const timestampUnix = BigInt(Math.floor(new Date(sessionStart).getTime() / 1000));

  const contract = getSignerContract();
  const tx = await contract.storeLog(bytes32Hash,timestampUnix,fileName,machineId);
  await tx.wait();

  const result = { fileName, entries: batch.entries.length, hash: hexHash };

  currentBatch = [];
  batchSessionStart = new Date().toISOString();

  return result;
}

export function getEngineStatus(): { running: boolean; pendingEntries: number; sessionStart: string } {
  return {
    running: isRunning,
    pendingEntries: currentBatch.length,
    sessionStart: batchSessionStart,
  };
}