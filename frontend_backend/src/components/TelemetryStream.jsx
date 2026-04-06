import { useEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';
import MetricChart from './MetricChart';
import { formatPulseTime, getTelemetryEntry } from '../utils/generateMachineLog';
import { generateHash } from '../utils/hash';
import { storeLogOnChain } from '../blockchain';

const TICK_RATE_MS = 10000;
const MAX_HISTORY = 30;
const MACHINE_ID = 'SENSOR-NODE-01';

const HEALTH_SCORES = {
  GOOD: 100,
  WARNING: 50,
  CRITICAL: 0,
};

const HEALTH_STYLES = {
  GOOD: {
    pill: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/20',
    dot: 'bg-emerald-400 shadow-[0_0_24px_rgba(74,222,128,0.8)]',
  },
  WARNING: {
    pill: 'text-amber-200 bg-amber-500/10 border-amber-400/20',
    dot: 'bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.8)]',
  },
  CRITICAL: {
    pill: 'text-rose-200 bg-rose-500/10 border-rose-400/20',
    dot: 'bg-rose-400 shadow-[0_0_24px_rgba(251,113,133,0.8)]',
  },
};

function encodeTimestamp(unixSeconds) {
  return btoa(String(unixSeconds))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createLogFile(log, userEmail) {
  const unixTs = Math.floor(new Date(log.timestamp).getTime() / 1000);
  const encoded = encodeTimestamp(unixTs);
  const fileName = `log_${encoded}.json`;

  const exportData = userEmail ? { ...log, user: userEmail } : log;
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  return {
    id: `${unixTs}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    url,
    createdAt: log.timestamp,
    data: exportData,
  };
}

async function verifyFolderPermission(dirHandle) {
  if (!dirHandle) return false;

  try {
    const options = { mode: 'readwrite' };

    if ((await dirHandle.queryPermission(options)) === 'granted') {
      return true;
    }

    if ((await dirHandle.requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  } catch (err) {
    console.error('Folder permission check failed:', err);
    return false;
  }
}

async function writeLogToSelectedFolder(dirHandle, fileRecord) {
  if (!dirHandle) return false;

  const hasPermission = await verifyFolderPermission(dirHandle);
  if (!hasPermission) return false;

  try {
    const fileHandle = await dirHandle.getFileHandle(fileRecord.fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(fileRecord.data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.error('File save failed:', err);
    return false;
  }
}

function SmallKpi({ label, value, unit, dotClass }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-theme-subtle">
          {label}
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight text-white">{value}</span>
        {unit ? (
          <span className="pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-subtle">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({ label, value, tone = 'text-theme-muted', mono = false }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-theme-subtle">
        {label}
      </p>
      <p className={`mt-2 break-all text-sm ${mono ? 'font-mono' : ''} ${tone}`}>
        {value}
      </p>
    </div>
  );
}

function TelemetryStream({ signer, user }) {
  const [logs, setLogs] = useState([]);
  const [files, setFiles] = useState([]);
  const [secondsUntilNext, setSecondsUntilNext] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [lastTxHash, setLastTxHash] = useState(null);
  const [folderSelected, setFolderSelected] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');

  const lastLogRef = useRef(null);
  const activeFileUrlsRef = useRef([]);
  const nextEmissionAtRef = useRef(Date.now());
  const generationTimeoutRef = useRef(null);
  const dirHandleRef = useRef(null);

  const supportsFolderSave =
    typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const handleSelectFolder = async () => {
    try {
      if (!supportsFolderSave) {
        alert('Your browser does not support folder save. Please use Chrome or Edge on desktop.');
        return;
      }

      const dirHandle = await window.showDirectoryPicker();
      const hasPermission = await verifyFolderPermission(dirHandle);

      if (!hasPermission) {
        setFolderSelected(false);
        dirHandleRef.current = null;
        return;
      }

      dirHandleRef.current = dirHandle;
      setFolderSelected(true);
      setSaveWarning('');
    } catch (err) {
      console.error('Folder selection cancelled or failed:', err);
    }
  };

  const tick = async () => {
    setIsGenerating(true);

    const nextLog = getTelemetryEntry(lastLogRef.current);
    const nextFile = createLogFile(nextLog, user?.email);

    lastLogRef.current = nextLog;
    nextEmissionAtRef.current = Date.now() + TICK_RATE_MS;
    setSecondsUntilNext(10);
    setGenerationCount((count) => count + 1);

    setLogs((current) => [nextLog, ...current].slice(0, MAX_HISTORY));
    setFiles((current) => [nextFile, ...current].slice(0, 10));

    if (dirHandleRef.current) {
      const saved = await writeLogToSelectedFolder(dirHandleRef.current, nextFile);

      if (!saved) {
        setSaveWarning('Autosave is currently unavailable.');
      } else {
        setSaveWarning('');
      }
    }

    if (signer && user) {
      try {
        const unixTimestamp = Math.floor(new Date(nextLog.timestamp).getTime() / 1000);
        const hash = await generateHash(nextLog);
        const txHash = await storeLogOnChain(hash, unixTimestamp, nextFile.fileName, MACHINE_ID, signer);
        setLastTxHash(txHash);
      } catch (err) {
        console.error('Failed to store on chain:', err);
      }
    }

    window.clearTimeout(generationTimeoutRef.current);
    generationTimeoutRef.current = window.setTimeout(() => {
      setIsGenerating(false);
    }, 1200);
  };

  useEffect(() => {
    if (!isRunning || !signer || !user) return;
    tick();
    return () => window.clearTimeout(generationTimeoutRef.current);
  }, [isRunning, signer, user]);

  useEffect(() => {
    if (!isRunning || !signer || !user) return;

    nextEmissionAtRef.current = Date.now() + TICK_RATE_MS;
    setSecondsUntilNext(10);

    const intervalId = window.setInterval(() => {
      tick();
    }, TICK_RATE_MS);

    const tickerId = window.setInterval(() => {
      const msRemaining = Math.max(0, nextEmissionAtRef.current - Date.now());
      setSecondsUntilNext(Math.ceil(msRemaining / 1000));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(tickerId);
    };
  }, [isRunning, signer, user]);

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
  const currentHealth = latestLog?.health || 'GOOD';
  const activeHealth = HEALTH_STYLES[currentHealth];
  const progressPercent = ((TICK_RATE_MS - secondsUntilNext * 1000) / TICK_RATE_MS) * 100;
  const safeProgressPercent = Math.max(0, Math.min(100, progressPercent));
  const reportsPerMinute = Math.round((60000 / TICK_RATE_MS) * 10) / 10;

  const metrics = useMemo(
    () => [
      {
        label: 'Temperature',
        value: latestLog ? latestLog.temperature : '--',
        unit: 'C',
      },
      {
        label: 'Speed',
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
    const timestamps = logs.map((l) => l.timestamp);
    return {
      timestamps,
      temperature: logs.map((l) => l.temperature),
      rpm: logs.map((l) => l.rpm),
      vibration: logs.map((l) => l.vibration),
      health: logs.map((l) => HEALTH_SCORES[l.health] || 0),
    };
  }, [logs]);

  const controllerMessage = !signer
    ? 'Wallet connection required.'
    : !user
      ? 'Google sign-in required.'
      : !isRunning
        ? generationCount === 0
          ? 'Ready to start telemetry stream.'
          : 'Telemetry stream paused.'
        : isGenerating
          ? 'Generating packet and updating records...'
          : `Next packet in ${secondsUntilNext}s`;

  return (
    <section id="telemetry" className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-300">
            Telemetry
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Real-time machine log stream
          </h2>
          <p className="mt-4 text-base leading-8 text-theme-muted">
            View current machine status, generate log packets, export files, and anchor records on-chain.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-muted">
          1 packet / 10s • {reportsPerMinute} ppm
        </div>
      </div>

      <Card className="p-0">
        <div className="grid gap-0 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="border-b border-white/10 p-6 sm:p-8 xl:border-b-0 xl:border-r">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-theme-subtle">
                  Live Snapshot
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {latestLog ? 'Current machine state' : 'Awaiting first packet'}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-theme-muted">
                  Latest telemetry values and health condition for the connected machine node.
                </p>
              </div>

              <div className={`rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] ${activeHealth.pill}`}>
                {latestLog?.health || 'IDLE'}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <SmallKpi
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  unit={metric.unit}
                  dotClass={activeHealth.dot}
                />
              ))}
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-theme-subtle">
                    Stream Control
                  </p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                    {controllerMessage}
                  </p>
                  {saveWarning ? (
                    <p className="mt-3 text-sm leading-6 text-amber-300">{saveWarning}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    {folderSelected ? 'Change Save Folder' : 'Select Save Folder'}
                  </button>

                  <button
                    type="button"
                    disabled={!signer || !user}
                    onClick={() => {
                      setIsRunning((current) => {
                        if (!current && generationCount === 0) {
                          setLogs([]);
                          setFiles([]);
                          setLastTxHash(null);
                          lastLogRef.current = null;
                          activeFileUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
                          activeFileUrlsRef.current = [];
                        }
                        return !current;
                      });
                    }}
                    className={`rounded-full border px-5 py-3 text-[11px] font-bold uppercase tracking-[0.22em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isRunning
                        ? 'border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
                        : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                    }`}
                  >
                    {!signer
                      ? 'Connect Wallet First'
                      : !user
                        ? 'Sign In First'
                        : isRunning
                          ? 'Stop Stream'
                          : generationCount === 0
                            ? 'Start Stream'
                            : 'Resume Stream'}
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-theme-subtle">
                  <span>Cycle Progress</span>
                  <span>{isRunning ? `${secondsUntilNext}s` : 'Paused'}</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full border border-white/8 bg-white/[0.04]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isRunning
                        ? 'bg-[linear-gradient(90deg,rgba(16,185,129,1)_0%,rgba(34,211,238,1)_50%,rgba(59,130,246,1)_100%)]'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${safeProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-theme-subtle">
              Session Details
            </p>

            <div className="mt-6 space-y-4">
              <InfoRow
                label="Machine Node"
                value={MACHINE_ID}
                tone="text-white"
                mono
              />

              <InfoRow
                label="Latest Timestamp"
                value={latestLog ? latestLog.timestamp : 'Awaiting synchronization...'}
                mono
              />

              <InfoRow
                label="Last Transaction"
                value={
                  signer
                    ? lastTxHash || 'No transaction recorded yet.'
                    : 'Wallet not connected.'
                }
                tone={signer ? (lastTxHash ? 'text-emerald-300' : 'text-theme-muted') : 'text-rose-300'}
                mono
              />

              <InfoRow
                label="Authenticated User"
                value={user ? user.email : 'No authenticated user'}
                tone={user ? 'text-cyan-200' : 'text-amber-300'}
                mono
              />

              <InfoRow
                label="Autosave"
                value={folderSelected ? 'Configured' : 'Not configured'}
                tone={folderSelected ? 'text-emerald-300' : 'text-amber-300'}
              />

              <InfoRow
                label="Packets Generated"
                value={generationCount.toString().padStart(4, '0')}
                tone="text-white"
                mono
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-200/80">
            History
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Recent telemetry trends
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <MetricChart
            title="Temperature Profile"
            data={historyData.temperature}
            timestamps={historyData.timestamps}
            color="blue"
            minValue={60}
            maxValue={100}
            unit="C"
          />
          <MetricChart
            title="Rotational Speed"
            data={historyData.rpm}
            timestamps={historyData.timestamps}
            color="rose"
            minValue={1300}
            maxValue={2000}
            unit="rpm"
          />
          <MetricChart
            title="Vibration Intensity"
            data={historyData.vibration}
            timestamps={historyData.timestamps}
            color="amber"
            minValue={0}
            maxValue={10}
            unit="mm/s"
          />
          <MetricChart
            title="Health Confidence"
            data={historyData.health}
            timestamps={historyData.timestamps}
            color="emerald"
            minValue={0}
            maxValue={100}
            unit="score"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card
          title="Recent Packets"
          subtitle="Latest machine log packets generated during the active session."
        >
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-12 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-theme-subtle">
                No packets yet
              </div>
            ) : (
              logs.map((log, index) => {
                const health = HEALTH_STYLES[log.health] || HEALTH_STYLES.GOOD;

                return (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className={`rounded-[24px] border p-4 transition ${
                      index === 0
                        ? 'border-emerald-400/20 bg-emerald-500/[0.05]'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${health.dot}`} />
                          <span className="text-sm font-semibold text-white">
                            {formatPulseTime(log.timestamp)}
                          </span>

                          {index === 0 ? (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                              Live
                            </span>
                          ) : null}

                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${health.pill}`}>
                            {log.health}
                          </span>
                        </div>

                        <p className="mt-3 font-mono text-[11px] text-theme-subtle">
                          EPOCH_{log.timestamp.replace(/[:.-]/g, '').slice(-8)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <DataBadge label="Temp" value={`${log.temperature} C`} />
                        <DataBadge label="RPM" value={log.rpm} />
                        <DataBadge label="Vib" value={`${log.vibration} mm/s`} />
                        <DataBadge label="State" value={log.health} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card
          title="Export Queue"
          subtitle="Generated JSON log files available for download."
        >
          <div className="space-y-3">
            {files.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-12 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-theme-subtle">
                No exports available
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <svg className="h-5 w-5 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                      </svg>
                    </div>

                    <div>
                      <p className="font-mono text-sm text-white">{file.fileName}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-theme-subtle">
                        {formatPulseTime(file.createdAt)}
                      </p>
                    </div>
                  </div>

                  <a
                    href={file.url}
                    download={file.fileName}
                    className="inline-flex items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    Export JSON
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

function DataBadge({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-theme-subtle">{label}</p>
      <p className="mt-1 text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

export default TelemetryStream;