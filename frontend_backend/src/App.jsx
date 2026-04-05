import { useEffect, useState } from 'react';
import IntegrityValidator from './components/IntegrityValidator';
import TelemetryStream from './components/TelemetryStream';
import ThemeToggle from './components/ThemeToggle';
import { connectWallet } from './blockchain';
import { auth, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [wallet, setWallet] = useState(null); // { address, provider, signer }
  const [user, setUser] = useState(null);

  // 100% Reliable Refresh Cleanup: Triggers on every page load/mount
  useEffect(() => {
    async function clearLogs() {
      try {
        await fetch("http://localhost:3001/api/clear-logs", {
          method: "DELETE",
        });
        console.log("Logs cleared on refresh");
      } catch (err) {
        console.error("Failed to clear logs", err);
      }
    }
    clearLogs();
  }, []);

  // 1. Persist Google Account Session (Firebase)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Persist Wallet Connection (localStorage)
  useEffect(() => {
    const previouslyConnected = localStorage.getItem('connected_wallet_address');
    if (previouslyConnected) {
      // Re-connect silently on mount if we had a stored address
      handleConnectWallet(true);
    }
  }, []);

  const handleConnectWallet = async (isAutoReconnect = false) => {
    try {
      const result = await connectWallet();
      setWallet(result);
      localStorage.setItem('connected_wallet_address', result.address);
    } catch (err) {
      if (!isAutoReconnect) {
        alert(err.message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const u = await signInWithGoogle();
      setUser(u);
    } catch (err) {
      // Ignored for UI simplicity
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setWallet(null);
    localStorage.removeItem('connected_wallet_address');
  };

  return (
    <div className="relative overflow-hidden text-theme-text transition-theme min-h-screen bg-theme-base">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:80px_80px] opacity-[0.15]" />
      <div className="pointer-events-none absolute left-[-10rem] top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-[30rem] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-16 px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
        <header className="rounded-[2.5rem] border border-theme-border/10 bg-theme-surface-glass/40 px-6 py-10 shadow-glow backdrop-blur-md sm:px-10 sm:py-12 transition-theme">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.4em] text-theme-accent-emerald font-bold">
                Industrial Monitoring System
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-theme-text sm:text-6xl transition-theme">
                Telemetry Integrity Dashboard
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-theme-muted sm:text-lg transition-theme">
                Monitor real-time machine performance and verify the cryptographic
                integrity of exported data samples to prevent unauthorized tampering.
              </p>
            </div>

            <nav className="flex flex-wrap gap-4 items-center">
              {wallet ? (
                <div className="rounded-full border border-theme-accent-purple/20 bg-theme-accent-purple/5 px-4 py-2.5 text-sm font-semibold text-theme-accent-purple-text">
                  Connected: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="rounded-full border border-theme-accent-purple/20 bg-theme-accent-purple/10 px-5 py-3 text-sm font-semibold text-theme-accent-purple-text transition hover:bg-theme-accent-purple/20"
                >
                  Connect Wallet
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-2 rounded-full border border-theme-accent-blue/20 bg-theme-accent-blue/5 px-4 py-2 text-sm font-semibold text-theme-accent-blue-text">
                  {user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />}
                  <div className="flex flex-col">
                    <span>{user.displayName}</span>
                    <span className="text-[10px] font-mono text-theme-accent-blue opacity-80 truncate max-w-[160px]">{user.email}</span>
                  </div>
                  <button onClick={handleLogout} className="ml-2 text-xs text-theme-muted hover:text-theme-text">Logout</button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="rounded-full border border-theme-accent-blue/20 bg-theme-accent-blue/10 px-5 py-3 text-sm font-semibold text-theme-accent-blue-text transition hover:bg-theme-accent-blue/20"
                >
                  Google Sign-in
                </button>
              )}

              <a
                href="#telemetry"
                className="rounded-full border border-theme-accent-emerald/20 bg-theme-accent-emerald/5 px-6 py-3.5 text-sm font-semibold text-theme-accent-emerald-text transition hover:bg-theme-accent-emerald/15"
              >
                Live Feed
              </a>
              <a
                href="#validator"
                className="rounded-full border border-theme-accent-cyan/20 bg-theme-accent-cyan/5 px-6 py-3.5 text-sm font-semibold text-theme-accent-cyan-text transition hover:bg-theme-accent-cyan/15"
              >
                Integrity Tool
              </a>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        {/* Live Simulation Section */}
        <TelemetryStream signer={wallet?.signer} user={user} />

        {/* Integrity Check Section — now uses signer for on-chain record lookup */}
        <IntegrityValidator signer={wallet?.signer} user={user} />

        <footer className="mt-auto py-10 border-t border-theme-border/5 text-center transition-theme">
          <p className="text-xs text-theme-subtle tracking-widest uppercase font-mono transition-theme">
            System Status: Nominal // Data Pipeline Active
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
