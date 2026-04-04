import { useState } from 'react';
import IntegrityValidator from './components/IntegrityValidator';
import TelemetryStream from './components/TelemetryStream';
import { connectWallet } from './blockchain';
import { signInWithGoogle, logout } from './firebase';

function App() {
  const [wallet, setWallet] = useState(null); // { address, provider, signer }
  const [user, setUser] = useState(null);

  const handleConnectWallet = async () => {
    try {
      const result = await connectWallet();
      setWallet(result);
    } catch (err) {
      alert(err.message);
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
  };

  return (
    <div className="relative overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:80px_80px] opacity-[0.15]" />
      <div className="pointer-events-none absolute left-[-10rem] top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-[30rem] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-16 px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
        <header className="rounded-[2.5rem] border border-white/10 bg-black/40 px-6 py-10 shadow-glow backdrop-blur-md sm:px-10 sm:py-12">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400/90 font-bold">
                Industrial Monitoring System
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Telemetry Integrity Dashboard
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                Monitor real-time machine performance and verify the cryptographic 
                integrity of exported data samples to prevent unauthorized tampering.
              </p>
            </div>

            <nav className="flex flex-wrap gap-4 items-center">
              {wallet ? (
                <div className="rounded-full border border-purple-400/20 bg-purple-400/5 px-4 py-2.5 text-sm font-semibold text-purple-100">
                  Connected: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="rounded-full border border-purple-400/20 bg-purple-400/10 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-purple-400/20"
                >
                  Connect Wallet
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/5 px-4 py-2 text-sm font-semibold text-blue-100">
                  {user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />}
                  <span>{user.displayName}</span>
                  <button onClick={handleLogout} className="ml-2 text-xs text-slate-400 hover:text-white">Logout</button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="rounded-full border border-blue-400/20 bg-blue-400/10 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-400/20"
                >
                  Google Sign-in
                </button>
              )}

              <a
                href="#telemetry"
                className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-6 py-3.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
              >
                Live Feed
              </a>
              <a
                href="#validator"
                className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-6 py-3.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Integrity Tool
              </a>
            </nav>
          </div>
        </header>

        {/* Live Simulation Section */}
        <TelemetryStream signer={wallet?.signer} />

        {/* Integrity Check Section — now uses signer for on-chain record lookup */}
        <IntegrityValidator signer={wallet?.signer} />
        
        <footer className="mt-auto py-10 border-t border-white/5 text-center">
          <p className="text-xs text-slate-600 tracking-widest uppercase font-mono">
            System Status: Nominal // Data Pipeline Active
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
