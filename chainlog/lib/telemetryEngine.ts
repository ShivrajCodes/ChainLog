import { getTelemetryEntry } from "@/lib/telemetry";
import { TelemetryEntry } from "@/lib/types";
import { generateSHA256Hash, hexToBytes32 } from "@/lib/hash";
import {
  getSignerContract,
  isChainConfigured,
  assertCorrectNetwork,
} from "@/lib/contract";
import { addRecord } from "@/lib/ledger";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";

const ENTRY_INTERVAL_MS = 3000;
const BATCH_INTERVAL_MS = 60000;

export interface TelemetryBatch {
  machineId: string;
  fileName: string;
  sessionStart: string;
  owner: string;
  entries: TelemetryEntry[];
}

let entryTimer: NodeJS.Timeout | null = null;
let batchTimer: NodeJS.Timeout | null = null;
let isRunning = false;

let currentBatch: TelemetryEntry[] = [];
let lastEntry: TelemetryEntry | undefined = undefined;
let batchSessionStart: string = new Date().toISOString();

let currentUser: string = "system";

function generateFileName(isoTimestamp: string): string {
  const safe = isoTimestamp
    .replace(/\.\d{3}Z$/, "")
    .replace(/:/g, "-");
  return `log-${safe}.json`;
}

async function flushBatchToChain(): Promise<void> {
  if (currentBatch.length === 0) return;

  const machineId = process.env.MACHINE_ID ?? "MOTOR-001";
  const sessionStart = batchSessionStart;
  const fileName = generateFileName(sessionStart);

  const batch: TelemetryBatch = {
    machineId,
    fileName,
    sessionStart,
    owner: currentUser,
    entries: [...currentBatch],
  };

  const fileHash = generateSHA256Hash(batch);
  const bytes32Hash = hexToBytes32(fileHash);

  const timestampUnix = BigInt(
    Math.floor(new Date(sessionStart).getTime() / 1000)
  );

  const recordId = createHash("sha256")
    .update(fileName)
    .digest("hex")
    .slice(0, 32);

  console.log(`[ChainLog] Flushing batch: ${fileName}`);
  console.log(`[ChainLog] Entries: ${batch.entries.length}`);
  console.log(`[ChainLog] Hash: ${fileHash}`);

  let txHash: string | undefined;
  let onChain = false;

  if (isChainConfigured()) {
    try {
      await assertCorrectNetwork();

      const contract = getSignerContract();
      const tx = await contract.storeLog(
        bytes32Hash,
        timestampUnix,
        fileName,
        machineId
      );

      await tx.wait();

      txHash = tx.hash;
      onChain = true;

      console.log("[ChainLog] Stored on-chain ✓");
    } catch (err) {
      console.error("[ChainLog] On-chain failed:", err);
    }
  } else {
    console.log("[ChainLog] Saving locally only (no blockchain config)");
  }

  await fs.writeFile(
    path.join(process.cwd(), "data", fileName),
    JSON.stringify(batch, null, 2)
  );

  await addRecord({
    recordId,
    fileName,
    fileHash,
    timestamp: Date.now(),
    machineId,
    entries: batch.entries.length,
    onChain,
    txHash,
    owner: currentUser,
  });

  currentBatch = [];
  batchSessionStart = new Date().toISOString();
}

export function startTelemetryEngine(userEmail: string): void {
  if (isRunning) {
    console.log("[ChainLog] Engine already running.");
    return;
  }

  currentUser = userEmail;

  isRunning = true;
  batchSessionStart = new Date().toISOString();

  console.log(`[ChainLog] Engine started for ${currentUser}`);

  entryTimer = setInterval(() => {
    const entry = getTelemetryEntry(lastEntry);
    lastEntry = entry;
    currentBatch.push(entry);

    console.log(
      `[ChainLog] Entry → temp:${entry.temperature} rpm:${entry.rpm} vib:${entry.vibration} health:${entry.health}`
    );
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

  await flushBatchToChain();

  console.log("[ChainLog] Engine stopped.");
}

export async function triggerManualFlush(): Promise<any> {
  if (currentBatch.length === 0) {
    return { message: "No data to flush" };
  }

  await flushBatchToChain();

  return { message: "Manual flush successful" };
}

export function getEngineStatus() {
  return {
    running: isRunning,
    pendingEntries: currentBatch.length,
    sessionStart: batchSessionStart,
    currentUser,
  };
}