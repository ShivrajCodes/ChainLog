export interface LogRecord {
  recordId: string;
  fileHash: string;
  timestamp: string;
  fileName: string;
  machineId: string;
  owner: string;
}

export interface StoreLogRequest {
  logContent: string;
  fileName: string;
  machineId: string;
  timestamp: number;
}

export interface StoreLogResponse {
  success: boolean;
  txHash: string;
  fileHash: string;
  timestamp: number;
  fileName: string;
  machineId: string;
}

export interface VerifyLogRequest {
  recordId: string;
  logContent: string;
}

export interface VerifyLogResponse {
  recordId: string;
  storedHash: string;
  recomputedHash: string;
  tampered: boolean;
  fileName: string;
  machineId: string;
  timestamp: string;
  owner: string;
}