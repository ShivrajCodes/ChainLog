import fs from "fs/promises";
import path from "path";

const LEDGER_PATH = path.join(process.cwd(), "data", "ledger.json");

export interface LedgerRecord {
  recordId: string;
  fileName: string;
  fileHash: string;
  timestamp: number;
  machineId: string;
  entries: number;
  onChain: boolean;
  txHash?: string;
  owner?: string;
}

export interface LedgerData {
  records: LedgerRecord[];
  users: unknown[];
  otpStore: Record<
    string,
    { otp: string; expiresAt: number; name: string; password: string }
  >;
}

const DEFAULT_LEDGER: LedgerData = {
  records: [],
  users: [],
  otpStore: {},
};

export async function readLedger(): Promise<LedgerData> {
  try {
    await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });

    const raw = await fs.readFile(LEDGER_PATH, "utf-8");

    if (!raw || raw.trim() === "") {
      return DEFAULT_LEDGER;
    }

    const parsed = JSON.parse(raw);

    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      otpStore:
        typeof parsed.otpStore === "object" && parsed.otpStore !== null
          ? parsed.otpStore
          : {},
    };
  } catch {
    return DEFAULT_LEDGER;
  }
}

export async function writeLedger(data: LedgerData): Promise<void> {
  await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });

  await fs.writeFile(
    LEDGER_PATH,
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

export async function addRecord(record: LedgerRecord): Promise<void> {
  const ledger = await readLedger();

  if (!Array.isArray(ledger.records)) {
    ledger.records = [];
  }

  ledger.records = [
    record,
    ...ledger.records.filter((r) => r.recordId !== record.recordId),
  ];

  await writeLedger(ledger);
}

export async function findRecordByHash(
  fileHash: string
): Promise<LedgerRecord | null> {
  const ledger = await readLedger();

  if (!Array.isArray(ledger.records)) return null;

  const needle = fileHash.replace(/^0x/, "").toLowerCase();

  return (
    ledger.records.find(
      (r) =>
        r.fileHash.replace(/^0x/, "").toLowerCase() === needle
    ) ?? null
  );
}

export async function getAllRecords(): Promise<LedgerRecord[]> {
  const ledger = await readLedger();

  if (!Array.isArray(ledger.records)) return [];

  return ledger.records;
}