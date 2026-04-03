import fs from "fs";
import path from "path";
import crypto from "crypto";

const LEDGER_PATH = path.join(process.cwd(), "data", "ledger.json");

export interface LedgerRecord {
  recordId: string;
  fileName: string;
  fileHash: string;       // hex SHA-256 of the batch JSON
  timestamp: number;      // unix ms (KEEP THIS)
  machineId: string;
  entries: number;
  owner: string;          // wallet address or session email
  onChain: boolean;       // true once submitted to Celo
  txHash?: string;
}

/* ─────────────────────────────────────────────────────────────── */
/* Ensure storage exists */
/* ─────────────────────────────────────────────────────────────── */

function ensureDir() {
  const dir = path.dirname(LEDGER_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(LEDGER_PATH)) {
    fs.writeFileSync(LEDGER_PATH, "[]", "utf8");
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* Read / Write */
/* ─────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────── */
/* Hashing */
/* ─────────────────────────────────────────────────────────────── */

export function hashBatch(data: unknown): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function makeRecordId(fileHash: string): string {
  return fileHash.slice(0, 64).padEnd(64, "0");
}

/* ─────────────────────────────────────────────────────────────── */
/* Timestamp Utilities */
/* ─────────────────────────────────────────────────────────────── */

/**
 * Get current timestamp (standardized)
 */
export function now(): number {
  return Date.now();
}

/**
 * Format timestamp for UI (clean readable)
 */
export function formatTimestamp(ts: number): string {
  const date = new Date(ts);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * ISO format (best for logs / debugging / blockchain consistency)
 */
export function formatISO(ts: number): string {
  return new Date(ts).toISOString();
}

/**
 * Relative time (nice UX: "2 mins ago")
 */
export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}