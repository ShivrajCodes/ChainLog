import { useEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';
import MetricChart from './MetricChart';
import { formatPulseTime, getTelemetryEntry } from '../utils/generateMachineLog';
import { generateSHA256Hash } from '../utils/hash';
import { storeLogOnChain } from '../blockchain';

const TICK_RATE_MS = 10000;
const MAX_HISTORY = 30;
const MACHINE_ID = 'SENSOR-NODE-01'; // Identifier for this telemetry source

// Internal mapping for numerical analytics
const HEALTH_SCORES = {
  GOOD: 100,
  WARNING: 50,
  CRITICAL: 0,
};

const HEALTH_STYLES = {
  GOOD: 'text-emerald-300 bg-emerald-500/15 ring-emerald-400/30',
  WARNING: 'text-amber-300 bg-amber-500/15 ring-amber-400/30',
  CRITICAL: 'text-rose-300 bg-rose-500/15 ring-rose-400/30',
};

function MetricCard({ label, value, unit, statusTone }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">{label}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${statusTone}`} />
      </div>

      <div className="mt-5 flex items-end gap-1.5">
        <span className="text-3xl font-semibold text-white sm:text-4xl">{value}</span>
        {unit ? <span className="pb-1 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-medium">{unit}</span> : null}
      </div>
    </Card>
  );
}

function statusAccent(health) {
  if (health === 'CRITICAL') return 'bg-rose-400 shadow-[0_0_24px_rgba(251,113,133,0.8)]';
  if (health === 'WARNING') return 'bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.8)]';
  return 'bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.8)]';
}

/**
 * Creates a local download record for the generated sample.
 */
function createLogFile(log) {
  const prettyTimestamp = log.timestamp.replace(/[:.]/g, '-');
  const fileName = `telemetry_${prettyTimestamp}.json`;
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  return {
    id: `${log.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    url,
    createdAt: log.timestamp,
  };
}

function TelemetryStream({ signer }) {
  const [logs, setLogs] = useState([]);
  const [files, setFiles] = useState([]);
  const [secondsUntilNext, setSecondsUntilNext] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [lastTxHash, setLastTxHash] = useState(null);

  const lastLogRef = useRef(null);
  const activeFileUrlsRef = useRef([]);
  const nextEmissionAtRef = useRef(Date.now());
  const generationTimeoutRef = useRef(null);

  // Core emission logic
  const tick = () => {
    setIsGenerating(true);
    const nextLog = getTelemetryEntry(lastLogRef.current);
    const nextFile = createLogFile(nextLog);

    lastLogRef.current = nextLog;
    nextEmissionAtRef.current = Date.now() + TICK_RATE_MS;
    setSecondsUntilNext(10);
    setGenerationCount((count) => count + 1);

    setLogs((current) => [nextLog, ...current].slice(0, MAX_HISTORY));
    setFiles((current) => [nextFile, ...current].slice(0, 10));

    // Fire and forget blockchain storage without blocking UI
    if (signer) {
      const unixTimestamp = Math.floor(new Date(nextLog.timestamp).getTime() / 1000);
      generateSHA256Hash(nextLog)
        .then((hash) => storeLogOnChain(hash, unixTimestamp, nextFile.fileName, MACHINE_ID, signer))
        .then((txHash) => setLastTxHash(txHash))
        .catch((err) => console.error('Failed to store on chain:', err));
    }

    window.clearTimeout(generationTimeoutRef.current);
    generationTimeoutRef.current = window.setTimeout(() => {
      setIsGenerating(false);
    }, 1200);
  };

  useEffect(() => {
    tick();
    return () => window.clearTimeout(generationTimeoutRef.current);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    nextEmissionAtRef.current = Date.now() + TICK_RATE_MS;
    setSecondsUntilNext(10);

    const intervalId = window.setInterval(tick, TICK_RATE_MS);
    const tickerId = window.setInterval(() => {
      const msRemaining = Math.max(0, nextEmissionAtRef.current - Date.now());
      setSecondsUntilNext(Math.ceil(msRemaining / 1000));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(tickerId);
    };
  }, [isRunning]);

  useEffect(() => {
    const previousUrls = activeFileUrlsRef.current;
    const nextUrls = files.map((item) => item.url);

    previousUrls
      .filter((url) => !nextUrls.includes(url))
      .forEach((url) => URL.revokeObjectURL(url));

    activeFileUrlsRef.current = nextUrls;
  }, [files]);

  useEffect(() => {
    return () => {
      activeFileUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const latestLog = logs[0];
  const healthPillClass = latestLog ? HEALTH_STYLES[latestLog.health] : HEALTH_STYLES.GOOD;
  const signalTone = latestLog ? statusAccent(latestLog.health) : statusAccent('GOOD');
  const progressPercent = ((TICK_RATE_MS - secondsUntilNext * 1000) / TICK_RATE_MS) * 100;
  const safeProgressPercent = Math.max(0, Math.min(100, progressPercent));
  const reportsPerMinute = Math.round((60000 / TICK_RATE_MS) * 10) / 10;

  const metrics = useMemo(
    () => [
      {
        label: 'Current Temp',
        value: latestLog ? latestLog.temperature : '--',
        unit: 'C',
      },
      {
        label: 'RPM Speed',
        value: latestLog ? latestLog.rpm : '--',
        unit: 'rpm',
      },
      {
        label: 'Vibration',
        value: latestLog ? latestLog.vibration : '--',
        unit: 'mm/s',
      },
    ],
    [latestLog],
  );

  const historyData = useMemo(() => {
    const timestamps = logs.map(l => l.timestamp);
    return {
      timestamps,
      temperature: logs.map(l => l.temperature),
      rpm: logs.map(l => l.rpm),
      vibration: logs.map(l => l.vibration),
      health: logs.map(l => HEALTH_SCORES[l.health] || 0)
    };
  }, [logs]);

  return (
    <section id="telemetry" className="space-y-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 font-bold">
            Real-Time Telemetry Feed
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Live industrial monitoring with high-fidelity signal tracking.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-400">
            Automated sensor snapshots are emitted every 10 seconds. These records
            represent the raw system state before any integrity measures are applied.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-5 py-3.5 text-xs text-slate-300 shadow-glow backdrop-blur font-mono">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full animate-pulseSoft ${signalTone}`} />
            <span>Emission Frequency: 1/10s (approx. {reportsPerMinute} ppm)</span>
          </div>
        </div>
      </div>

      {/* Snapshot and Status Pulse */}
      <Card className="relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="grid gap-8 lg:grid-cols-[1.6fr_0.95fr]">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
                  System Snapshot
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Latest observed telemetry received from live sensors.
                </p>
              </div>
              <div
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] ring-1 transition-all duration-500 ${healthPillClass}`}
              >
                {latestLog?.health ?? 'INITIALIZING'}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  unit={metric.unit}
                  statusTone={signalTone}
                />
              ))}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-white/5 bg-white/[0.02] p-6 shadow-inner">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">
                    Emission Controller
                  </p>
                  <p className="mt-3 text-xl font-medium text-white">
                    {!isRunning
                      ? 'Stream paused (Manual Override)'
                      : isGenerating
                        ? 'Compiling packet...'
                        : `Next packet in ${secondsUntilNext}s`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-full bg-slate-900 border border-white/5 px-4 py-2.5 text-[10px] font-mono text-emerald-400 tracking-wider">
                    TOTAL_SENT: {generationCount.toString().padStart(4, '0')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRunning((current) => !current)}
                    className={`rounded-full border px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${isRunning
                        ? 'border-rose-400/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 active:scale-95'
                        : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 active:scale-95'
                      }`}
                  >
                    {isRunning ? 'Stop Feed' : 'Resume Feed'}
                  </button>
                </div>
              </div>

              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-900 border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${isRunning
                      ? 'bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400'
                      : 'bg-slate-700'
                    }`}
                  style={{ width: `${safeProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-slate-950/60 p-6 shadow-glow">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">Pulse Diagnostics</p>
            <div className="mt-8 space-y-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Calculated Health</p>
                <p className="mt-3 text-3xl font-semibold text-white tracking-tight">{latestLog?.health ?? '--'}</p>
              </div>
              <div className="pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Emission Epoch</p>
                <p className="mt-3 text-xs font-mono text-slate-300 transition-all duration-300">
                  {latestLog ? latestLog.timestamp : 'Awaiting sync...'}
                </p>
              </div>
              <div className="pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">On-Chain Storage</p>
                <div className="mt-3 flex flex-col gap-2 text-[10px] font-mono">
                  {signer ? (
                    lastTxHash ? (
                      <span className="text-emerald-400 break-all bg-emerald-400/10 p-2 rounded-lg border border-emerald-400/20">
                        TX: {lastTxHash}
                      </span>
                    ) : (
                      <span className="text-slate-400">Awaiting block confirmation...</span>
                    )
                  ) : (
                    <span className="text-rose-400">Wallet offline. Connect to broadcast map.</span>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-white/5">
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  Telemetry logs are buffered locally up to 30 cycles for high-fidelity trend analysis before being exported for integrity verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Historical Trends Grid - Matching User Reference */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Historical Trends</h2>
          <p className="mt-2 text-sm text-slate-400">High-fidelity signal tracking over the last 30 measurements.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <MetricChart
            title="Temperature Over Time"
            data={historyData.temperature}
            timestamps={historyData.timestamps}
            color="blue"
            minValue={60}
            maxValue={100}
            unit="C"
          />
          <MetricChart
            title="RPM Over Time"
            data={historyData.rpm}
            timestamps={historyData.timestamps}
            color="rose"
            minValue={1300}
            maxValue={2000}
            unit="rpm"
          />
          <MetricChart
            title="Vibration Over Time"
            data={historyData.vibration}
            timestamps={historyData.timestamps}
            color="amber"
            minValue={0}
            maxValue={10}
            unit="mm/s"
          />
          <MetricChart
            title="Health Score Over Time"
            data={historyData.health}
            timestamps={historyData.timestamps}
            color="emerald"
            minValue={0}
            maxValue={100}
            unit="score"
          />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <Card
          title="Recent Snapshots"
          subtitle="Real-time buffer of emitted telemetry packets for audit tracking."
        >
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 px-8 py-12 text-center text-xs text-slate-500 uppercase tracking-widest">
                Awaiting first transmission...
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={`grid gap-4 rounded-2xl border bg-slate-950/40 p-4 transition-all duration-300 hover:border-white/20 sm:grid-cols-[1.2fr_1fr] ${index === 0 ? 'border-emerald-500/20 shadow-inner bg-emerald-500/[0.02]' : 'border-white/5'
                    }`}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusAccent(log.health)}`} />
                      <span className="text-xs font-semibold text-white">
                        {formatPulseTime(log.timestamp)}
                      </span>
                      {index === 0 && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300 animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[10px] tracking-wider text-slate-500 font-mono">
                      EPOCH_{log.timestamp.replace(/[:.-]/g, '').slice(-8)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="text-slate-600">T:</span>{log.temperature}C</span>
                    <span className="flex items-center gap-1.5"><span className="text-slate-600">R:</span>{log.rpm}</span>
                    <span className="flex items-center gap-1.5"><span className="text-slate-600">V:</span>{log.vibration}</span>
                    <span className="flex items-center gap-1.5"><span className="text-slate-600">H:</span>{log.health}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Data Exports"
          subtitle="Secure JSON telemetry manifests ready for cryptographic audit."
        >
          <div className="space-y-3">
            {files.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 px-8 py-12 text-center text-xs text-slate-500 uppercase tracking-widest">
                No exports available.
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-950/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/5">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] text-white tracking-tighter">{file.fileName}</p>
                      <p className="mt-1 text-[10px] text-slate-500 font-medium">
                        TS_{formatPulseTime(file.createdAt)}
                      </p>
                    </div>
                  </div>

                  <a
                    href={file.url}
                    download={file.fileName}
                    className="inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/5 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10 active:scale-95"
                  >
                    EXPORT
                  </a>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

export default TelemetryStream;
