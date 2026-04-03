export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startTelemetryEngine } = await import('@/lib/telemetryEngine');
    startTelemetryEngine();
  }
}