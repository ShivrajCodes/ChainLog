import { useState } from 'react';
import Card from './Card';
import { generateSHA256Hash } from '../utils/hash';
import { verifyFileIntegrity } from '../blockchain';

const VALIDATION_STATES = {
  AUTHENTIC: {
    container: 'border-emerald-400/35 bg-emerald-500/10',
    label: 'text-emerald-300',
    message: 'Integrity Verified',
  },
  TAMPERED: {
    container: 'border-rose-400/35 bg-rose-500/10',
    label: 'text-rose-300',
    message: 'Tampering Detected',
  },
};

function IntegrityValidator({ signer }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a JSON telemetry file first.');
      return;
    }
    if (!signer) {
      setErrorMessage('Please connect your Web3 wallet to verify on-chain integrity.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setResult(null);

    try {
      const text = await selectedFile.text();
      const jsonData = JSON.parse(text);
      const computedHash = await generateSHA256Hash(jsonData);
      
      const { isAuthentic, matchedRecord } = await verifyFileIntegrity(computedHash, signer);

      setResult({
        uploadedHash: '0x' + computedHash,
        originalHash: isAuthentic ? matchedRecord.fileHash : 'No matching record found',
        fileName: isAuthentic ? matchedRecord.fileName : null,
        machineId: isAuthentic ? matchedRecord.machineId : null,
        recordTimestamp: isAuthentic ? new Date(matchedRecord.timestamp * 1000).toISOString() : null,
        status: isAuthentic ? 'AUTHENTIC' : 'TAMPERED',
      });
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMessage('On-chain verification failed. Ensure your wallet is connected to the right network.');
    } finally {
      setIsVerifying(false);
    }
  };

  const activeStyle = result ? VALIDATION_STATES[result.status] : null;

  return (
    <section id="validator" className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">
          File Integrity check
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Validate the authenticity of exported telemetry logs.
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Upload a previously exported JSON record to check for potential 
          data tampering or corruption during transit.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card
          title="Input Selection"
          subtitle="Select a local .json file for cryptographic verification."
          className="h-full"
        >
          <label className="block rounded-3xl border border-dashed border-white/15 bg-slate-950/80 p-6 transition hover:border-cyan-300/35">
            <span className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Source JSON File
            </span>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setResult(null);
                setErrorMessage('');
              }}
              className="mt-4 block w-full cursor-pointer rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-400/20"
            />
          </label>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">File Handle</p>
            <p className="mt-2 font-mono text-xs text-white truncate">
              {selectedFile ? selectedFile.name : 'No selection'}
            </p>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Running hash check...' : 'Verify Authenticity'}
          </button>
        </Card>

        <Card
          title="Validation Result"
          subtitle="Cryptographic proof and integrity status will appear here."
          className="h-full"
        >
          {result && activeStyle ? (
            <div className={`rounded-3xl border p-6 ${activeStyle.container}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.4em] ${activeStyle.label}`}>
                {result.status}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">{activeStyle.message}</h3>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">On-Chain Hash</p>
                  <p className="mt-2 break-all font-mono text-[11px] text-slate-400">
                    {result.originalHash || 'N/A'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Computed File Hash</p>
                  <p className="mt-2 break-all font-mono text-[11px] text-slate-400">
                    {result.uploadedHash || 'N/A'}
                  </p>
                </div>

                {result.status === 'AUTHENTIC' && (
                  <>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Recorded File Name</p>
                      <p className="mt-2 font-mono text-[11px] text-emerald-400">
                        {result.fileName}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Machine ID</p>
                        <p className="mt-2 font-mono text-[11px] text-cyan-400">
                          {result.machineId}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Stored At</p>
                        <p className="mt-2 font-mono text-[11px] text-slate-400">
                          {result.recordTimestamp}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-8 text-center">
              <div className="max-w-xs">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Ready for Input
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Select a telemetry record to compare its cryptographic signature 
                  against the on-chain log registry.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

export default IntegrityValidator;
