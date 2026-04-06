import { useEffect, useMemo, useState } from 'react';
import IntegrityValidator from './components/IntegrityValidator';
import TelemetryStream from './components/TelemetryStream';
// import { connectWallet } from './blockchain';
import { connectWallet, disconnectWallet, wasWalletPreviouslyConnected } from './blockchain';
import { auth, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [wallet, setWallet] = useState(null);
  const [user, setUser] = useState(null);

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tryReconnect = async () => {
      if (!wasWalletPreviouslyConnected()) return;

      try {
        const result = await connectWallet({ silent: true });
        setWallet(result);
      } catch (err) {
        console.error('Silent wallet reconnect failed:', err);
        setWallet(null);
      }
    };

    tryReconnect();
  }, []);

  // Handle MetaMask account/network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        setWallet(null);
        return;
      }

      try {
        const result = await connectWallet({ silent: true });
        setWallet(result);
      } catch (err) {
        console.error(err);
        setWallet(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Connect Wallet (forces MetaMask account selection popup)
  const handleConnectWallet = async () => {
    try {
      const result = await connectWallet({ forceAccountSelection: true });
      setWallet(result);
    } catch (err) {
      alert(err.message);
    }
  };

  // Disconnect wallet app-side
  const handleDisconnectWallet = () => {
    disconnectWallet();
    setWallet(null);
  };

  // Google Sign-in
  const handleGoogleSignIn = async () => {
    try {
      const u = await signInWithGoogle();
      setUser(u);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  // System status badge
  const systemState = useMemo(() => {
    if (wallet && user) {
      return {
        label: 'Operational',
        tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
      };
    }

    if (wallet || user) {
      return {
        label: 'Partial',
        tone: 'text-amber-300 bg-amber-500/10 border-amber-400/20',
      };
    }

    return {
      label: 'Standby',
      tone: 'text-slate-300 bg-white/[0.04] border-white/10',
    };
  }, [wallet, user]);

  return (
    <div className="min-h-screen bg-theme-base text-theme-text">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(22,163,74,0.10),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.12),transparent_24%)]" />
        <div className="absolute inset-0 bg-grid bg-[size:72px_72px] opacity-[0.08]" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        {/* HEADER */}
        <header className="sticky top-4 z-30 mb-6 rounded-[28px] border border-white/10 bg-theme-panel/70 px-5 py-4 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            {/* LEFT */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
                <span className="text-lg font-bold text-white">CL</span>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-300">
                  ChainLog
                </p>
                <h1 className="text-xl font-semibold text-white">
                  Log Integrity Platform
                </h1>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex flex-wrap items-center gap-3">
              {/* STATUS */}
              <div
                className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase ${systemState.tone}`}
              >
                {systemState.label}
              </div>

              {/* WALLET */}
              {wallet ? (
                <>
                  <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100">
                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </div>

                  <button
                    onClick={handleDisconnectWallet}
                    className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-100 hover:bg-rose-500/20"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100 hover:bg-cyan-500/20"
                >
                  Connect Wallet
                </button>
              )}

              {/* USER */}
              {user ? (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="text-white">{user.email}</span>

                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-theme-muted hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="mb-8 overflow-hidden rounded-[36px] border border-white/10 bg-theme-panel/75 p-6 shadow-glow backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.8)]" />
                Blockchain-backed monitoring
              </div>

              <h2 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Immutable machine logs
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-emerald-200 bg-clip-text text-transparent">
                  with real-time validation
                </span>
              </h2>

              <p className="mt-6 max-w-3xl text-base leading-8 text-theme-muted sm:text-lg">
                Generate telemetry records, store trusted references on-chain,
                and validate exported files through a single operational
                workspace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#telemetry"
                  className="rounded-full border border-white/10 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
                >
                  Open Telemetry
                </a>
                <a
                  href="#validator"
                  className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-6 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Open Validator
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <StatTile
                  value="10s"
                  label="Sync Cycle"
                  helper="Continuous packet generation for machine log monitoring."
                />
                <StatTile
                  value="JSON"
                  label="Log Export"
                  helper="Structured machine records prepared for storage and verification."
                />
                <StatTile
                  value="Web3"
                  label="Proof Layer"
                  helper="Trusted on-chain reference for integrity validation."
                />
              </div>
            </div>

            <div className="grid gap-4">
              <FeatureCard
                eyebrow="Live Monitoring"
                title="Telemetry Stream"
                text="Track current machine state, health condition, exports, and recent activity from a single dashboard."
              />
              <FeatureCard
                eyebrow="Data Integrity"
                title="Blockchain Verification"
                text="Compare exported log files against recorded on-chain hashes to confirm authenticity."
              />
              <FeatureCard
                eyebrow="Operational Control"
                title="Secure Workflow"
                text="Connect wallet, sign in, export machine logs, and validate results with full traceability."
              />
            </div>
          </div>
        </section>

        {/* MAIN FEATURES */}
        <TelemetryStream signer={wallet?.signer} user={user} />
        <IntegrityValidator signer={wallet?.signer} user={user} />

        {/* FOOTER */}
        <footer className="mt-10 rounded-[28px] border border-white/10 bg-theme-panel/70 px-6 py-5 text-center shadow-glow">
          <p className="text-[11px] uppercase tracking-[0.3em] text-theme-subtle">
            ChainLog • Monitor • Verify • Secure
          </p>
        </footer>
      </main>
    </div>
  );
}

function StatTile({ value, label, helper }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-theme-subtle">
        {label}
      </p>
      <p className="mt-3 text-sm leading-6 text-theme-muted">{helper}</p>
    </div>
  );
}

function FeatureCard({ eyebrow, title, text }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-200/80">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-theme-muted">{text}</p>
    </div>
  );
}

export default App;