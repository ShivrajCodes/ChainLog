import { TelemetryEntry, HealthState } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getTelemetryEntry(
  previousLog?: TelemetryEntry
): TelemetryEntry {
  const prevTemp = previousLog?.temperature ?? 68;
  const prevRpm = previousLog?.rpm ?? 1480;
  const prevVib = previousLog?.vibration ?? 3.1;

  const temperature = Number(
    clamp(prevTemp + (Math.random() * 10 - 5), 56, 103).toFixed(1)
  );

  const rpm = Math.round(
    clamp(prevRpm + (Math.random() * 180 - 90), 900, 3200)
  );

  const vibration = Number(
    clamp(prevVib + (Math.random() * 1.6 - 0.8), 1.2, 8.8).toFixed(2)
  );

  let health: HealthState = "GOOD";
  if (temperature > 92 || vibration > 7.2) health = "CRITICAL";
  else if (temperature > 78 || vibration > 5.2) health = "WARNING";

  return {
    temperature,
    rpm,
    vibration,
    health,
    timestamp: new Date().toISOString(),
  };
}