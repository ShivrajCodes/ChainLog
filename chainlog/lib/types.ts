export type HealthState = "GOOD" | "WARNING" | "CRITICAL";

export interface TelemetryEntry {
  temperature: number;
  rpm: number;
  vibration: number;
  health: HealthState;
  timestamp: string;
}