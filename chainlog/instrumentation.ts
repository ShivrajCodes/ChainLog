/**
 * Next.js instrumentation hook.
 * FIX #2: The telemetry engine is NOT auto-started here anymore.
 * It is started explicitly via POST /api/telemetry/start once the user
 * has authenticated AND confirmed wallet readiness in the UI.
 *
 * This prevents unconfigured batches from being generated before
 * PRIVATE_KEY / CONTRACT_ADDRESS are available.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[ChainLog] Server ready. Telemetry engine not auto-started — waiting for wallet confirmation.");
  }
}