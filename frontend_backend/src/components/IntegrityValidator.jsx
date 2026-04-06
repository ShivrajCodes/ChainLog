import { useState } from 'react';
import Card from './Card';
import { generateHash, toBytes32 } from '../utils/hash';
import { verifyFileIntegrity } from '../blockchain';

const RESULT_STYLES = {
  AUTHENTIC: {
    shell: 'border-emerald-400/20 bg-emerald-500/[0.06]',
    badge: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/20',
    title: 'Integrity Verified',
    summary:
      'The uploaded file matches the blockchain-backed record.',
  },
  TAMPERED: {
    shell: 'border-rose-400/20 bg-rose-500/[0.06]',
    badge: 'text-rose-200 bg-rose-500/10 border-rose-400/20',
    title: 'Tampering Detected',
    summary:
      'The uploaded file does not match the trusted on-chain record.',
  },
};

function DetailBlock({ label, value, mono = false, tone = 'text-theme-muted' }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-theme-subtle">
        {label}
      </p>
      <p className={`mt-2 break-all text-sm ${mono ? 'font-mono' : ''} ${tone}`}>
        {value || 'N/A'}
      </p>
    </div>
  );
}

function IntegrityValidator({ signer, user }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = async () => {
    if (!user) {
      setErrorMessage('Please sign in with Google first.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please select a JSON file first.');
      return;
    }

    if (!signer) {
      setErrorMessage('Please connect your wallet first.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setResult(null);

    try {
      if (!signer.provider) {
        throw new Error('Wallet provider is not ready yet. Please wait a moment and try again.');
      }

      const network = await signer.provider.getNetwork();
      if (network.chainId !== 11142220n) {
        throw new Error('Wrong network. Please switch MetaMask to Celo Sepolia.');
      }

      const text = await selectedFile.text();
      const jsonData = JSON.parse(text);

      const computedHash = await generateHash(jsonData);
      const computedHashBytes32 = toBytes32(computedHash);

      const { isAuthentic, matchedRecord } = await verifyFileIntegrity(
        computedHash,
        selectedFile.name,
        signer
      );

      const originalHash = matchedRecord ? matchedRecord.fileHash : 'No matching record found';
      const hashesMatch =
        matchedRecord &&
        matchedRecord.fileHash &&
        matchedRecord.fileHash.toLowerCase() === computedHashBytes32.toLowerCase();

      setResult({
        status: isAuthentic ? 'AUTHENTIC' : 'TAMPERED',
        uploadedHashRaw: `0x${computedHash}`,
        uploadedHash: computedHashBytes32,
        originalHash,
        fileName: matchedRecord ? matchedRecord.fileName : selectedFile.name,
        machineId: matchedRecord ? matchedRecord.machineId : null,
        recordTimestamp: matchedRecord
          ? new Date(matchedRecord.timestamp * 1000).toISOString()
          : null,
        verifiedBy: user.email,
        hashesMatch,
      });
    } catch (err) {
      console.error('Verification error:', err);

      if (err?.code === 4001) {
        setErrorMessage('MetaMask request was rejected.');
      } else if (err?.code === 'CALL_EXCEPTION') {
        setErrorMessage('Contract call failed. Please check contract address, ABI, and deployed network.');
      } else if (err?.message?.toLowerCase().includes('wrong network')) {
        setErrorMessage('Wrong network. Please switch MetaMask to Celo Sepolia.');
      } else if (err?.message?.toLowerCase().includes('provider')) {
        setErrorMessage('Wallet provider is not ready yet. Please wait a moment and try again.');
      } else {
        setErrorMessage(err?.message || 'On-chain verification failed.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const activeResult = result ? RESULT_STYLES[result.status] : null;

  return (
    <section id="validator" className="mt-8 space-y-8">
      <div className="max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-200/80">
          Validator
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          File integrity verification
        </h2>
        <p className="mt-4 text-base leading-8 text-theme-muted">
          Upload an exported JSON file and compare it against its blockchain-backed reference.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card
          title="Verification Input"
          subtitle="Select the exported JSON file to verify."
        >
          <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.03] p-5 transition hover:border-cyan-400/25">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-theme-subtle">
              Source File
            </p>

            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setResult(null);
                setErrorMessage('');
              }}
              className="mt-4 block w-full cursor-pointer rounded-2xl border border-white/10 bg-theme-surface/70 px-4 py-3 text-sm text-theme-muted file:mr-4 file:rounded-full file:border file:border-cyan-400/20 file:bg-cyan-500/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-cyan-100 hover:file:bg-cyan-500/20"
            />
          </div>

          <div className="mt-5 grid gap-4">
            <DetailBlock
              label="Selected File"
              value={selectedFile ? selectedFile.name : 'No file selected'}
              mono
              tone={selectedFile ? 'text-white' : 'text-theme-muted'}
            />

            <DetailBlock
              label="Operator"
              value={user ? user.email : 'No authenticated user'}
              mono
              tone={user ? 'text-cyan-200' : 'text-amber-300'}
            />

            <DetailBlock
              label="Wallet State"
              value={signer ? 'Connected' : 'Not connected'}
              tone={signer ? 'text-emerald-300' : 'text-amber-300'}
            />
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVerifying ? 'Verifying...' : 'Run Verification'}
          </button>
        </Card>

        <Card
          title="Verification Result"
          subtitle="Integrity outcome and blockchain comparison details."
        >
          {result && activeResult ? (
            <div className={`rounded-[28px] border p-5 sm:p-6 ${activeResult.shell}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className={`inline-flex rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] ${activeResult.badge}`}>
                    {result.status}
                  </div>

                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                    {activeResult.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-theme-muted">
                    {activeResult.summary}
                  </p>
                </div>

                <div className={`rounded-2xl border px-4 py-3 text-center ${activeResult.badge}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em]">Hash Match</p>
                  <p className="mt-1 text-sm font-semibold">
                    {result.hashesMatch ? 'Matched' : 'Not matched'}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <DetailBlock
                  label="On-chain Hash"
                  value={result.originalHash}
                  mono
                  tone="text-theme-muted"
                />

                <DetailBlock
                  label="Computed Hash"
                  value={result.uploadedHash}
                  mono
                  tone="text-theme-muted"
                />

                <DetailBlock
                  label="Raw File Hash"
                  value={result.uploadedHashRaw}
                  mono
                  tone="text-theme-muted"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <DetailBlock
                    label="Recorded File Name"
                    value={result.fileName}
                    mono
                    tone="text-white"
                  />
                  <DetailBlock
                    label="Machine ID"
                    value={result.machineId || 'Unavailable'}
                    mono
                    tone={result.machineId ? 'text-cyan-200' : 'text-theme-muted'}
                  />
                  <DetailBlock
                    label="Record Timestamp"
                    value={result.recordTimestamp || 'Unavailable'}
                    mono
                    tone={result.recordTimestamp ? 'text-emerald-300' : 'text-theme-muted'}
                  />
                  <DetailBlock
                    label="Verified By"
                    value={result.verifiedBy}
                    mono
                    tone="text-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-theme-subtle">
                No Verification Yet
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Awaiting input
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-theme-muted">
                Upload a file and run verification to view the integrity result and related record details.
              </p>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

export default IntegrityValidator;