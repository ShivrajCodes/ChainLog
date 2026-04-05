export * from "@/lib/types";

export interface TelemetryBatch {
  machineId: string;
  fileName: string;
  sessionStart: string;
  entries: import("@/lib/types").TelemetryEntry[];
}

export interface OnChainRecord {
  recordId: string;
  fileHash: string;
  fileName: string;
  machineId: string;
  owner?: string;
  timestamp: number;
}

export interface StoreLogRequest {
  logContent: unknown;
  fileName: string;
  machineId: string;
}

export interface StoreLogResponse {
  success: boolean;
  txHash: string;
  fileHash: string;
  fileName: string;
  machineId: string;
}

export interface VerifyLogRequest {
  recordId: string;
  logContent: unknown;
}

export interface VerifyLogResponse {
  tampered: boolean;
  onChainHash: string;
  currentHash: string;
  record: {
    fileName: string;
    machineId: string;
    owner?: string;
    timestamp: number;
  };
}

export interface FetchLogsResponse {
  records: OnChainRecord[];
}

export interface EngineStatus {
  running: boolean;
  pendingEntries: number;
  sessionStart: string;
}

export interface ManualFlushResponse {
  message: string;
  fileName?: string;
  entries?: number;
  hash?: string;
}