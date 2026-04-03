export type HealthState = 'GOOD' | 'WARNING' | 'CRITICAL';

export type TelemetryEntry = {
  timestamp: string;
  temperature: number;
  rpm: number;
  vibration: number;
  health: HealthState;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function drift(value: number, variation: number): number {
  return value + (Math.random() * 2 - 1) * variation;
}

function computeHealth(temp: number, rpm: number, vibration: number): HealthState {
  if (temp > 90 || vibration > 8 || rpm > 5000) {
    return 'CRITICAL';
  }
  if (temp > 75 || vibration > 5 || rpm > 4000) {
    return 'WARNING';
  }
  return 'GOOD';
}

export function getTelemetryEntry(prev?: TelemetryEntry): TelemetryEntry {
  let temperature = prev?.temperature ?? 60;
  let rpm = prev?.rpm ?? 3000;
  let vibration = prev?.vibration ?? 2;

  temperature = clamp(drift(temperature, 2), 40, 100);
  rpm = clamp(drift(rpm, 150), 1000, 6000);
  vibration = clamp(drift(vibration, 0.5), 0.5, 10);

  if (Math.random() < 0.05) {
    temperature += Math.random() * 10;
    vibration += Math.random() * 2;
  }

  const health = computeHealth(temperature, rpm, vibration);

  return {
    timestamp: new Date().toISOString(),
    temperature: Number(temperature.toFixed(2)),
    rpm: Math.round(rpm),
    vibration: Number(vibration.toFixed(2)),
    health,
  };
}