import fs from "fs";
import path from "path";
import crypto from "crypto";

const LEDGER_PATH = path.join(process.cwd(), "data", "ledger.json");

export interface LedgerRecord {
  recordId: string;
  fileName: string;
  fileHash: string;       // hex SHA-256 of the batch JSON
  timestamp: number;      // unix ms
  machineId: string;
  entries: number;
  owner: string;          // wallet address or session email
  onChain: boolean;       // true once submitted to Celo
  txHash?: string;
}

function ensureDir() {
  const dir = path.dirname(LEDGER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LEDGER_PATH)) fs.writeFileSync(LEDGER_PATH, "[]", "utf8");
}

export function readLedger(): LedgerRecord[] {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as LedgerRecord[];
  } catch {
    return [];
  }
}

export function writeLedger(records: LedgerRecord[]) {
  ensureDir();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(records, null, 2), "utf8");
}

export function appendRecord(record: LedgerRecord) {
  const all = readLedger();
  all.unshift(record); // newest first
  writeLedger(all);
}

export function findRecord(fileHash: string): LedgerRecord | undefined {
  return readLedger().find((r) => r.fileHash === fileHash);
}

export function hashBatch(data: unknown): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function makeRecordId(fileHash: string): string {
  // bytes32 hex without 0x prefix — same format as the Solidity contract
  return fileHash.slice(0, 64).padEnd(64, "0");
}