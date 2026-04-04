const HEALTH_STATES = ['GOOD', 'WARNING', 'CRITICAL'];

/**
 * Standard clamp utility for keeping values within safe bounds.
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Logic to determine system health based on raw telemetry.
 * Warning thresholds are currently hardcoded for the demo.
 */
function getHealth(temperature, vibration) {
  // Thresholds based on sensor spec v2.1
  if (temperature > 92 || vibration > 7.2) {
    return HEALTH_STATES[2]; // CRITICAL
  }

  if (temperature > 78 || vibration > 5.2) {
    return HEALTH_STATES[1]; // WARNING
  }

  return HEALTH_STATES[0]; // GOOD
}

export function getTelemetryEntry(previousLog) {
  const previousTemperature = previousLog?.temperature ?? 68;
  const previousRpm = previousLog?.rpm ?? 1480;
  const previousVibration = previousLog?.vibration ?? 3.1;

  // Add some random drift to simulate real sensor noise
  const temperature = Number(
    clamp(previousTemperature + (Math.random() * 10 - 5), 56, 103).toFixed(1),
  );
  const rpm = Math.round(clamp(previousRpm + (Math.random() * 180 - 90), 900, 3200));
  const vibration = Number(
    clamp(previousVibration + (Math.random() * 1.6 - 0.8), 1.2, 8.8).toFixed(2),
  );
  const health = getHealth(temperature, vibration);

  return {
    temperature,
    rpm,
    vibration,
    health,
    timestamp: new Date().toISOString(),
  };
}

export function formatPulseTime(isoValue) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(isoValue));
}
