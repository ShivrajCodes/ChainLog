import { useState } from 'react';
import Card from './Card';
import { generateHash } from '../utils/hash';
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

function IntegrityValidator({ signer, user }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = async () => {
    if (!user) {
      setErrorMessage('Please login with Google first to verify integrity.');
      return;
    }
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
      const computedHash = await generateHash(jsonData);

      const { isAuthentic, matchedRecord } = await verifyFileIntegrity(computedHash, signer);

      setResult({
        uploadedHash: '0x' + computedHash,
        originalHash: isAuthentic ? matchedRecord.fileHash : 'No matching record found',
        fileName: isAuthentic ? matchedRecord.fileName : null,
        machineId: isAuthentic ? matchedRecord.machineId : null,
        recordTimestamp: isAuthentic ? new Date(matchedRecord.timestamp * 1000).toISOString() : null,
        verifiedBy: user.email,
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
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-theme-text sm:text-5xl">
          Validate the authenticity of exported telemetry logs.
        </h2>
        <p className="mt-4 text-base leading-7 text-theme-muted">
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
          <label className="block rounded-3xl border border-dashed border-theme-border/15 bg-theme-surface/80 p-6 transition hover:border-cyan-300/35">
            <span className="text-xs uppercase tracking-[0.28em] text-theme-subtle">
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
              className="mt-4 block w-full cursor-pointer rounded-2xl border border-theme-border/10 bg-theme-surface px-4 py-3 text-xs text-theme-muted file:mr-4 file:rounded-full file:border file:border-theme-text/80 file:bg-theme-accent-blue/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-theme-accent-blue-text hover:file:bg-theme-accent-blue/20"
            />
          </label>

          <div className="mt-5 rounded-2xl border border-theme-border/10 bg-theme-surface/70 p-4 text-sm text-theme-muted">
            <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">File Handle</p>
            <p className="mt-2 font-mono text-xs text-theme-text truncate">
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
            className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-theme-text/80 bg-theme-accent-blue/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-theme-accent-blue-text transition hover:bg-theme-accent-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h3 className="mt-3 text-xl font-semibold text-theme-text">{activeStyle.message}</h3>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-theme-border/5 bg-theme-surface/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">On-Chain Hash</p>
                  <p className="mt-2 break-all font-mono text-[11px] text-theme-muted">
                    {result.originalHash || 'N/A'}
                  </p>
                </div>

                <div className="rounded-2xl border border-theme-border/5 bg-theme-surface/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">Computed File Hash</p>
                  <p className="mt-2 break-all font-mono text-[11px] text-theme-muted">
                    {result.uploadedHash || 'N/A'}
                  </p>
                </div>

                {result.status === 'AUTHENTIC' && (
                  <>
                    <div className="rounded-2xl border border-theme-border/5 bg-theme-surface/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">Recorded File Name</p>
                      <p className="mt-2 font-mono text-[11px] text-emerald-400">
                        {result.fileName}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-theme-border/5 bg-theme-surface/20 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">Machine ID</p>
                        <p className="mt-2 font-mono text-[11px] text-cyan-400">
                          {result.machineId}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-theme-border/5 bg-theme-surface/20 p-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">Stored At</p>
                        <p className="mt-2 font-mono text-[11px] text-theme-muted">
                          {result.recordTimestamp}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {result.verifiedBy && (
                  <div className="rounded-2xl border border-theme-border/5 bg-theme-surface/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-theme-subtle">Verified By</p>
                    <p className="mt-2 font-mono text-[11px] text-blue-400">
                      {result.verifiedBy}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-dashed border-theme-border/10 bg-theme-surface/70 p-8 text-center">
              <div className="max-w-xs">
                <p className="text-xs uppercase tracking-[0.3em] text-theme-subtle">
                  Ready for Input
                </p>
                <p className="mt-3 text-sm leading-6 text-theme-muted">
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
