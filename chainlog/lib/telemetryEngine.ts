import { getTelemetryEntry } from "@/lib/telemetry";
import { TelemetryEntry } from "@/lib/types";
import { generateSHA256Hash, hexToBytes32 } from "@/lib/hash";
import { getSignerContract, isChainConfigured, assertCorrectNetwork } from "@/lib/contract";
import { addRecord } from "@/lib/ledger";
import fs from "fs/promises";
import path from "path";

const INTERVAL_MS = 30000;

export interface TelemetrySnapshot {
  machineId: string;
  fileName: string;
  timestamp: number;
  owner: string;
  entry: TelemetryEntry;
}

let timer: NodeJS.Timeout | null = null;
let isRunning = false;

let lastEntry: TelemetryEntry | undefined = undefined;
let currentUser: string = "system";

async function captureAndStore(): Promise<any> {
  const machineId = process.env.MACHINE_ID ?? "MOTOR-001";
  const now = Date.now();
  const unix = Math.floor(now / 1000);
  const fileName = `log-${unix}.json`;

  const entry = getTelemetryEntry(lastEntry);
  lastEntry = entry;

  const snapshot: TelemetrySnapshot = {
    machineId,
    fileName,
    timestamp: unix,
    owner: currentUser,
    entry,
  };

  const fileHash = generateSHA256Hash(snapshot);
  const bytes32Hash = hexToBytes32(fileHash);

  let txHash: string | undefined;
  let onChain = false;

  if (isChainConfigured()) {
    try {
      await assertCorrectNetwork();
      const contract = getSignerContract();
      const tx = await contract.storeLog(bytes32Hash, unix, fileName, machineId);
      await tx.wait();
      txHash = tx.hash;
      onChain = true;
    } catch (err) {
      console.error("[ChainLog] On-chain failed:", err);
    }
  }

  await fs.writeFile(
    path.join(process.cwd(), "data", fileName),
    JSON.stringify(snapshot, null, 2)
  );

  await addRecord({
    recordId: fileHash.slice(0, 32),
    fileName,
    fileHash,
    timestamp: now,
    machineId,
    entries: 1,
    onChain,
    txHash,
    owner: currentUser,
  });

  return { fileName, hash: fileHash };
}

export function startTelemetryEngine(userEmail: string): void {
  if (isRunning) return;

  currentUser = userEmail;
  isRunning = true;

  timer = setInterval(() => {
    captureAndStore().catch(console.error);
  }, INTERVAL_MS);
}

export async function stopTelemetryEngine(): Promise<void> {
  if (!isRunning) return;

  if (timer) clearInterval(timer);
  timer = null;
  isRunning = false;

  await captureAndStore();
}

export async function triggerManualFlush(): Promise<any> {
  return await captureAndStore();
}

export function getEngineStatus() {
  return {
    running: isRunning,
    interval: INTERVAL_MS,
    currentUser,
  };
}