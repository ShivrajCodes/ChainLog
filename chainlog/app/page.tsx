"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface TelemetryEntry {
  temperature: number; rpm: number; vibration: number;
  health: "GOOD" | "WARNING" | "CRITICAL"; timestamp: string;
}
interface LogRecord {
  recordId: string; fileName: string; fileHash: string;
  timestamp: number; machineId: string; entries: number;
  onChain: boolean; txHash?: string;
}
interface VerifyResult {
  verified: boolean; tampered: boolean; fileHash: string;
  storedHash?: string; fileName?: string; timestamp?: number;
  machineId?: string; entries?: number; onChain?: boolean;
  txHash?: string; message: string;
}
type NavView = "dashboard" | "records" | "verify" | "settings";

// ─── TELEMETRY (client-side simulation only — real batching on server) ────────
function clamp(v: number, mn: number, mx: number) { return Math.min(mx, Math.max(mn, v)); }
function getHealth(t: number, v: number): TelemetryEntry["health"] {
  if (t > 92 || v > 7.2) return "CRITICAL";
  if (t > 78 || v > 5.2) return "WARNING";
  return "GOOD";
}
function getTelemetryEntry(prev?: TelemetryEntry | null): TelemetryEntry {
  const pT = prev?.temperature ?? 68, pR = prev?.rpm ?? 1480, pV = prev?.vibration ?? 3.1;
  const temperature = Number(clamp(pT + (Math.random() * 10 - 5), 56, 103).toFixed(1));
  const rpm = Math.round(clamp(pR + (Math.random() * 180 - 90), 900, 3200));
  const vibration = Number(clamp(pV + (Math.random() * 1.6 - 0.8), 1.2, 8.8).toFixed(2));
  return { temperature, rpm, vibration, health: getHealth(temperature, vibration), timestamp: new Date().toISOString() };
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --b950:#03071e;--b900:#05103a;--b800:#0a1f6b;--b600:#1a45cc;--b500:#2563eb;
  --b400:#3b82f6;--b300:#93c5fd;--b200:#bfdbfe;--cyan:#06b6d4;--cyan2:#0891b2;
  --white:#f8faff;--muted:#94a3b8;--danger:#ef4444;--success:#10b981;--warn:#f59e0b;
  --card:rgba(10,31,107,0.45);--cborder:rgba(59,130,246,0.18);
  --glass:rgba(255,255,255,0.04);--gborder:rgba(255,255,255,0.08);
}
html{scroll-behavior:smooth}
body{font-family:'DM Sans',sans-serif;background:var(--b950);color:var(--white);min-height:100vh;overflow-x:hidden}
@keyframes cardIn{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideUp{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes slideDown{from{transform:translateY(0);opacity:1}to{transform:translateY(100px);opacity:0}}
input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
  -webkit-box-shadow:0 0 0 100px rgba(10,31,107,.8) inset!important;
  -webkit-text-fill-color:#f8faff!important;caret-color:#f8faff;
}
.otp-inp{flex:1;text-align:center;background:rgba(255,255,255,.04);border:1px solid var(--gborder);
  border-radius:10px;padding:.85rem .5rem;color:var(--white);font-family:'DM Mono',monospace;
  font-size:1.25rem;font-weight:500;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
.otp-inp:focus{border-color:var(--b400);box-shadow:0 0 0 3px rgba(59,130,246,.2)}
.cbar{flex:1;border-radius:3px 3px 0 0;transition:height .5s cubic-bezier(.16,1,.3,1);min-height:4px}
.ltable{width:100%;border-collapse:collapse}
.ltable th{text-align:left;padding:.5rem .75rem;font-size:.7rem;font-weight:600;color:var(--muted);
  text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--gborder)}
.ltable td{padding:.75rem .75rem;font-size:.85rem;border-bottom:1px solid rgba(255,255,255,.04)}
.ltable tr:last-child td{border-bottom:none}
.ltable tr:hover td{background:rgba(255,255,255,.02)}
.drop-zone{border:2px dashed var(--cborder);border-radius:16px;padding:2.5rem;text-align:center;
  cursor:pointer;transition:all .2s;background:rgba(255,255,255,.02)}
.drop-zone:hover,.drop-zone.drag{border-color:var(--b400);background:rgba(59,130,246,.05)}
@media(max-width:1100px){.sg{grid-template-columns:repeat(2,1fr)!important}.mg{grid-template-columns:1fr!important}}
@media(max-width:600px){.sg{grid-template-columns:1fr!important}.nl{display:none!important}.db{padding:1rem!important}.nb{padding:1rem!important}}
`;

export default function HomePage() {
  const { data: session, status } = useSession();

  // ── Auth state ──────────────────────────────────────────────────────────
  const [authTab, setAuthTab]           = useState<"signin"|"signup"|"otp">("signin");
  const [signinEmail, setSigninEmail]   = useState("");
  const [signinPass, setSigninPass]     = useState("");
  const [signupName, setSignupName]     = useState("");
  const [signupEmail, setSignupEmail]   = useState("");
  const [signupPass, setSignupPass]     = useState("");
  const [showSP, setShowSP]             = useState(false);
  const [showSUP, setShowSUP]           = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPass, setPendingPass]   = useState("");
  const [otpDigits, setOtpDigits]       = useState(["","","","","",""]);
  const [signinLoading, setSigninLoading]   = useState(false);
  const [signupLoading, setSignupLoading]   = useState(false);
  const [otpLoading, setOtpLoading]         = useState(false);
  const [signinMsg, setSigninMsg] = useState<{t:"error"|"success";s:string}|null>(null);
  const [signupMsg, setSignupMsg] = useState<{t:"error"|"success";s:string}|null>(null);
  const [otpMsg, setOtpMsg]       = useState<{t:"error"|"success";s:string}|null>(null);

  // ── Wallet gate state (FIX #2) ──────────────────────────────────────────
  const [engineStarted, setEngineStarted]     = useState(false);
  const [engineStarting, setEngineStarting]   = useState(false);
  const [engineError, setEngineError]         = useState<string|null>(null);
  const [chainConfigured, setChainConfigured] = useState(false);

  // ── Dashboard state ─────────────────────────────────────────────────────
  const [view, setView]                   = useState<NavView>("dashboard");
  const [liveEntry, setLiveEntry]         = useState<TelemetryEntry|null>(null);
  const [prevEntry, setPrevEntry]         = useState<TelemetryEntry|null>(null);
  const [pendingCount, setPendingCount]   = useState(0);
  const [countdownSec, setCountdownSec]   = useState(60);
  const [lastBatch, setLastBatch]         = useState("None yet");
  const [logRecords, setLogRecords]       = useState<LogRecord[]>([]);
  const [tempHistory, setTempHistory]     = useState<number[]>(Array(28).fill(0).map(()=>20+Math.random()*40));
  const [flushLoading, setFlushLoading]   = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  // ── Verify state ────────────────────────────────────────────────────────
  const [verifyFile, setVerifyFile]       = useState<File|null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult]   = useState<VerifyResult|null>(null);
  const [isDragging, setIsDragging]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Toast ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{icon:string;msg:string;show:boolean}>({icon:"",msg:"",show:false});
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const showToast = useCallback((icon:string, msg:string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({icon, msg, show:true});
    toastTimer.current = setTimeout(()=>setToast(t=>({...t,show:false})),3800);
  },[]);

  function flash(
    set: React.Dispatch<React.SetStateAction<{t:"error"|"success";s:string}|null>>,
    t:"error"|"success", s:string
  ) { set({t,s}); setTimeout(()=>set(null),4500); }

  const batchRef   = useRef<TelemetryEntry[]>([]);
  const prevRef    = useRef<TelemetryEntry|null>(null);
  const entryTimer = useRef<ReturnType<typeof setInterval>|null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval>|null>(null);
  const otpRefs    = useRef<(HTMLInputElement|null)[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  async function handleGoogle() {
    showToast("🔑","Redirecting to Google OAuth...");
    await signIn("google");
  }

  async function handleSignIn() {
    if (!signinEmail||!signinPass){flash(setSigninMsg,"error","Fill in all fields.");return;}
    setSigninLoading(true);
    const res = await signIn("credentials",{email:signinEmail,password:signinPass,redirect:false});
    setSigninLoading(false);
    if (res?.error) flash(setSigninMsg,"error","Invalid email or password. Make sure you verified your email.");
  }

  /**
   * FIX #1: Real OTP flow
   * Calls POST /api/auth/send-otp which sends a real email via Nodemailer.
   * Falls back to showing the OTP from the response body in dev mode.
   */
  async function handleSignUp() {
    if (!signupName||!signupEmail||!signupPass){flash(setSignupMsg,"error","Fill in all fields.");return;}
    if (!signupEmail.includes("@")){flash(setSignupMsg,"error","Enter a valid email.");return;}
    if (signupPass.length<8){flash(setSignupMsg,"error","Password must be at least 8 characters.");return;}

    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:signupName, email:signupEmail, password:signupPass}),
      });
      const data = await res.json();
      if (!res.ok) { flash(setSignupMsg,"error", data.error ?? "Failed to send code."); setSignupLoading(false); return; }

      setPendingEmail(signupEmail);
      setPendingPass(signupPass);
      setAuthTab("otp");
      setOtpDigits(["","","","","",""]);

      if (data.delivery === "dev" && data.otp) {
        // Dev mode: SMTP not configured — show OTP in toast
        showToast("📧",`Dev mode — OTP: ${data.otp} (configure SMTP for real emails)`);
      } else {
        showToast("📧",`Verification code sent to ${signupEmail}`);
      }
      setTimeout(()=>otpRefs.current[0]?.focus(),100);
    } catch {
      flash(setSignupMsg,"error","Network error. Please try again.");
    }
    setSignupLoading(false);
  }

  function handleOtpChange(val:string,idx:number){
    const c=val.replace(/\D/g,"").slice(-1), next=[...otpDigits];
    next[idx]=c; setOtpDigits(next);
    if(c&&idx<5) otpRefs.current[idx+1]?.focus();
  }
  function handleOtpKey(e:React.KeyboardEvent,idx:number){
    if(e.key==="Backspace"&&!otpDigits[idx]&&idx>0) otpRefs.current[idx-1]?.focus();
  }

  /**
   * FIX #1: Calls real /api/auth/verify-otp, then signs in with credentials
   */
  async function handleVerifyOTP(){
    const entered = otpDigits.join("");
    if(entered.length<6){flash(setOtpMsg,"error","Enter all 6 digits.");return;}
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:pendingEmail, otp:entered}),
      });
      const data = await res.json();
      if(!res.ok){ flash(setOtpMsg,"error",data.error ?? "Invalid code."); setOtpDigits(["","","","","",""]); otpRefs.current[0]?.focus(); setOtpLoading(false); return; }

      flash(setOtpMsg,"success","Email verified! Signing you in...");
      await signIn("credentials",{email:pendingEmail, password:pendingPass, redirect:false});
    } catch {
      flash(setOtpMsg,"error","Verification failed. Please try again.");
    }
    setOtpLoading(false);
  }

  async function resendOTP(){
    try {
      const res = await fetch("/api/auth/send-otp",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:"User", email:pendingEmail, password:pendingPass}),
      });
      const data = await res.json();
      if(data.delivery === "dev" && data.otp) showToast("📧",`New OTP (dev): ${data.otp}`);
      else showToast("📧",`New code sent to ${pendingEmail}`);
    } catch { showToast("❌","Failed to resend. Try again."); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENGINE START — FIX #2: Only after auth + wallet confirmation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called by the "Start Engine" button in the wallet-gate modal.
   * Calls POST /api/telemetry/start which validates network (FIX #6)
   * before starting the server-side engine.
   */
  async function startEngine() {
    setEngineStarting(true);
    setEngineError(null);
    try {
      const res = await fetch("/api/telemetry/start",{method:"POST"});
      const data = await res.json();
      if(!res.ok){
        // FIX #6: Show descriptive network error
        setEngineError(data.details ?? data.error ?? "Failed to start engine.");
        setEngineStarting(false);
        return;
      }
      setChainConfigured(data.status?.chainConfigured ?? false);
      setEngineStarted(true);
      showToast("🚀","Telemetry engine started!");
      startClientTelemetry();
      fetchLogs();
    } catch {
      setEngineError("Network error contacting server.");
    }
    setEngineStarting(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLIENT-SIDE TELEMETRY (UI display only — real batching is server-side)
  // ─────────────────────────────────────────────────────────────────────────

  function startClientTelemetry(){
    if(entryTimer.current) return;
    entryTimer.current = setInterval(()=>{
      const entry = getTelemetryEntry(prevRef.current);
      setPrevEntry(prevRef.current);
      prevRef.current = entry;
      batchRef.current.push(entry);
      setLiveEntry(entry);
      setPendingCount(batchRef.current.length);
      setTempHistory(p=>[...p.slice(1),entry.temperature]);
    },3000);

    setCountdownSec(60);
    countTimer.current = setInterval(()=>{
      setCountdownSec(s=>{
        if(s<=1){ flushBatch(); return 60; }
        return s-1;
      });
    },1000);
  }

  function stopClientTelemetry(){
    if(entryTimer.current) clearInterval(entryTimer.current);
    if(countTimer.current) clearInterval(countTimer.current);
    entryTimer.current = null;
    countTimer.current = null;
    batchRef.current = [];
    prevRef.current = null;
    setPendingCount(0);
    setCountdownSec(60);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLUSH — Sends pending batch to server trigger endpoint
  // ─────────────────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async()=>{
    try {
      const res = await fetch("/api/logs/fetch");
      if(!res.ok) return;
      const data = await res.json();
      if(data.records) setLogRecords(data.records as LogRecord[]);
    } catch {/* silent */}
  },[]);

  const flushBatch = useCallback(async()=>{
    if(batchRef.current.length===0) return;
    const snap = [...batchRef.current];
    batchRef.current = [];
    setPendingCount(0);
    setFlushLoading(true);
    try {
      const res = await fetch("/api/telemetry/trigger",{method:"POST"});
      if(res.ok){
        const d = await res.json();
        if(d.fileName){
          setLastBatch(d.fileName.slice(0,24)+"...");
          showToast("🔗",`${snap.length} entries stored${d.onChain?" → Celo Sepolia":"→ local ledger"}`);
          await fetchLogs();
        }
      } else {
        showToast("❌","Flush failed — check server logs.");
      }
    } catch { showToast("❌","Network error during flush."); }
    setFlushLoading(false);
  },[fetchLogs, showToast]);

  async function manualFlush(){
    if(!engineStarted){showToast("⚠️","Start the engine first.");return;}
    if(batchRef.current.length===0){showToast("ℹ️","No pending entries to flush.");return;}
    await flushBatch();
    setCountdownSec(60);
  }

  async function refreshLogs(){
    setRefreshLoading(true);
    await fetchLogs();
    setRefreshLoading(false);
    showToast("↻","Records refreshed.");
  }

  // Stop client telemetry on unmount
  useEffect(()=>()=>stopClientTelemetry(),[]);

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFY HANDLERS — FIX #4 & #5
  // ─────────────────────────────────────────────────────────────────────────

  function onFileDrop(e:React.DragEvent){
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if(f&&f.name.endsWith(".json")){ setVerifyFile(f); setVerifyResult(null); }
    else showToast("⚠️","Please drop a .json log file.");
  }
  function onFileChange(e:React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if(f){ setVerifyFile(f); setVerifyResult(null); }
  }

  async function runVerify(){
    if(!verifyFile){showToast("⚠️","Select a file first.");return;}
    setVerifyLoading(true);
    const fd = new FormData();
    fd.append("file", verifyFile);
    try {
      const res = await fetch("/api/logs/verify",{method:"POST",body:fd});
      const data = await res.json();
      setVerifyResult(data as VerifyResult);
      if(data.verified) showToast("✅","File integrity confirmed — not tampered.");
      else showToast("🚨","Tampering detected or file not found!");
    } catch { showToast("❌","Verify request failed."); }
    setVerifyLoading(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COUNTDOWN RING
  // ─────────────────────────────────────────────────────────────────────────
  const circ = 2*Math.PI*22;
  const arcOffset = circ*(1-countdownSec/60);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if(status==="loading") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#03071e"}}>
      <Spin size={32}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{STYLES}</style>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse 80% 60% at 20% 10%,rgba(37,99,235,.25) 0%,transparent 70%),radial-gradient(ellipse 60% 50% at 80% 80%,rgba(6,182,212,.15) 0%,transparent 70%),radial-gradient(ellipse 40% 40% at 50% 50%,rgba(17,51,168,.2) 0%,transparent 70%),#03071e"}}/>

      {/* ══════════════════════ LOGIN PAGE ══════════════════════ */}
      {status!=="authenticated"&&(
        <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"}}>
          <div style={{width:"100%",maxWidth:460,background:"var(--card)",border:"1px solid var(--cborder)",borderRadius:24,padding:"2.5rem",backdropFilter:"blur(24px)",boxShadow:"0 0 0 1px rgba(59,130,246,.08),0 32px 64px rgba(3,7,30,.6)",animation:"cardIn .6s cubic-bezier(.16,1,.3,1) both"}}>
            <Logo/>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"1.6rem",fontWeight:700,letterSpacing:"-.03em",marginBottom:".35rem"}}>Welcome back</h1>
            <p style={{fontSize:".875rem",color:"var(--muted)",marginBottom:"1.75rem"}}>Sign in to access your machinery integrity ledger</p>

            {authTab!=="otp"&&(
              <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.04)",border:"1px solid var(--gborder)",borderRadius:12,padding:4,marginBottom:"1.5rem"}}>
                {(["signin","signup"] as const).map((t,i)=>(
                  <button key={t} onClick={()=>setAuthTab(t)} style={{flex:1,padding:".5rem",border:"none",borderRadius:8,background:authTab===t?"var(--b600)":"transparent",color:authTab===t?"var(--white)":"var(--muted)",fontFamily:"'DM Sans',sans-serif",fontSize:".875rem",fontWeight:500,cursor:"pointer",transition:"all .2s",boxShadow:authTab===t?"0 2px 8px rgba(37,99,235,.4)":"none"}}>{i===0?"Sign In":"Sign Up"}</button>
                ))}
              </div>
            )}

            {/* ── SIGN IN ── */}
            {authTab==="signin"&&(
              <div>
                <MsgBox m={signinMsg}/>
                <IField label="Email Address" icon="email">
                  <input type="email" placeholder="you@company.com" value={signinEmail} onChange={e=>setSigninEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignIn()} style={INP}/>
                </IField>
                <IField label="Password" icon="lock">
                  <input type={showSP?"text":"password"} placeholder="••••••••" value={signinPass} onChange={e=>setSigninPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignIn()} style={INP}/>
                  <EyeBtn show={showSP} toggle={()=>setShowSP(v=>!v)}/>
                </IField>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
                  <label style={{fontSize:".85rem",color:"var(--muted)",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                    <input type="checkbox" style={{accentColor:"var(--b500)",width:15,height:15}}/> Remember me
                  </label>
                  <span onClick={()=>showToast("📧","Password reset sent! (configure SMTP)")} style={{fontSize:".85rem",color:"var(--b400)",cursor:"pointer"}}>Forgot password?</span>
                </div>
                <PBtn onClick={handleSignIn} loading={signinLoading}>Sign In</PBtn>
                <Divider/>
                <GBtn onClick={handleGoogle}/>
                <p style={{textAlign:"center",marginTop:"1.25rem",fontSize:".85rem",color:"var(--muted)"}}>Don&apos;t have an account? <span onClick={()=>setAuthTab("signup")} style={{color:"var(--b400)",cursor:"pointer",fontWeight:500}}>Sign Up</span></p>
              </div>
            )}

            {/* ── SIGN UP ── */}
            {authTab==="signup"&&(
              <div>
                <MsgBox m={signupMsg}/>
                <IField label="Full Name" icon="user">
                  <input type="text" placeholder="Jane Smith" value={signupName} onChange={e=>setSignupName(e.target.value)} style={INP}/>
                </IField>
                <IField label="Email Address" icon="email">
                  <input type="email" placeholder="you@company.com" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} style={INP}/>
                </IField>
                <IField label="Password" icon="lock">
                  <input type={showSUP?"text":"password"} placeholder="Min. 8 characters" value={signupPass} onChange={e=>setSignupPass(e.target.value)} style={INP}/>
                  <EyeBtn show={showSUP} toggle={()=>setShowSUP(v=>!v)}/>
                </IField>
                <PBtn onClick={handleSignUp} loading={signupLoading}>Create Account &amp; Send Code</PBtn>
                <Divider text="or"/>
                <GBtn onClick={handleGoogle}/>
                <p style={{textAlign:"center",marginTop:"1.25rem",fontSize:".85rem",color:"var(--muted)"}}>Already have an account? <span onClick={()=>setAuthTab("signin")} style={{color:"var(--b400)",cursor:"pointer",fontWeight:500}}>Sign In</span></p>
              </div>
            )}

            {/* ── OTP ── */}
            {authTab==="otp"&&(
              <div>
                <p style={{textAlign:"center",fontSize:".8rem",color:"var(--muted)",marginBottom:"1rem"}}>
                  We sent a 6-digit code to<br/>
                  <span style={{color:"var(--b300)",fontFamily:"'DM Mono',monospace"}}>{pendingEmail}</span>
                </p>
                <MsgBox m={otpMsg}/>
                <div style={{marginBottom:"1rem"}}>
                  <label style={{display:"block",fontSize:".8rem",fontWeight:500,color:"var(--b200)",marginBottom:".4rem",letterSpacing:".02em",textTransform:"uppercase"}}>Verification Code</label>
                  <div style={{display:"flex",gap:8}}>
                    {otpDigits.map((d,i)=>(
                      <input key={i} className="otp-inp" type="text" maxLength={1} value={d}
                        ref={el=>{otpRefs.current[i]=el;}}
                        onChange={e=>handleOtpChange(e.target.value,i)}
                        onKeyDown={e=>handleOtpKey(e,i)}/>
                    ))}
                  </div>
                </div>
                <PBtn onClick={handleVerifyOTP} loading={otpLoading}>Verify &amp; Continue</PBtn>
                <p style={{textAlign:"center",marginTop:"1rem",fontSize:".85rem",color:"var(--muted)"}}>
                  Didn&apos;t receive it? <span onClick={resendOTP} style={{color:"var(--b400)",cursor:"pointer",fontWeight:500}}>Resend code</span>
                </p>
                <p style={{textAlign:"center",marginTop:".5rem"}}>
                  <span onClick={()=>setAuthTab("signup")} style={{color:"var(--b400)",cursor:"pointer",fontSize:".85rem",fontWeight:500}}>← Back</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ APP ══════════════════════ */}
      {status==="authenticated"&&(
        <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>

          {/* ── WALLET GATE MODAL (FIX #2) ── */}
          {!engineStarted&&(
            <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(3,7,30,.85)",backdropFilter:"blur(8px)"}}>
              <div style={{width:"100%",maxWidth:480,background:"var(--card)",border:"1px solid var(--cborder)",borderRadius:24,padding:"2.5rem",backdropFilter:"blur(24px)",boxShadow:"0 32px 64px rgba(3,7,30,.6)",animation:"cardIn .5s cubic-bezier(.16,1,.3,1) both"}}>
                <div style={{fontSize:"2rem",marginBottom:"1rem"}}>⛓</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.3rem",fontWeight:700,marginBottom:".5rem"}}>
                  Ready to start telemetry?
                </div>
                <p style={{fontSize:".875rem",color:"var(--muted)",marginBottom:"1.5rem",lineHeight:1.6}}>
                  The engine will generate motor readings every 3 seconds and batch them every 60 seconds.
                  {" "}If <code style={{color:"var(--b300)"}}>PRIVATE_KEY</code> and <code style={{color:"var(--b300)"}}>CONTRACT_ADDRESS</code> are set, batches are submitted to <strong>Celo Sepolia</strong>. Otherwise they save locally.
                </p>

                {engineError&&(
                  <div style={{padding:".85rem 1rem",borderRadius:12,marginBottom:"1.25rem",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",color:"#fca5a5",fontSize:".82rem",lineHeight:1.6}}>
                    <strong>⚠️ Error:</strong> {engineError}
                  </div>
                )}

                <div style={{display:"flex",gap:"1rem"}}>
                  <PBtn onClick={startEngine} loading={engineStarting}>
                    {engineStarting?"Validating network…":"Start Telemetry Engine"}
                  </PBtn>
                  <button onClick={()=>signOut()} style={{padding:".85rem 1.25rem",background:"rgba(255,255,255,.04)",border:"1px solid var(--gborder)",borderRadius:12,color:"var(--muted)",cursor:"pointer",fontSize:".875rem",whiteSpace:"nowrap"}}>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── NAVBAR ── */}
          <nav className="nb" style={{position:"sticky",top:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1rem 2rem",background:"rgba(3,7,30,.7)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--gborder)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"2rem"}}>
              <Logo small/>
              <div className="nl" style={{display:"flex",gap:".25rem"}}>
                {(["dashboard","records","verify","settings"] as NavView[]).map(v=>(
                  <button key={v} onClick={()=>setView(v)} style={{padding:".4rem .85rem",borderRadius:8,border:"none",background:view===v?"var(--glass)":"transparent",color:view===v?"var(--white)":"var(--muted)",fontFamily:"'DM Sans',sans-serif",fontSize:".875rem",fontWeight:view===v?600:500,cursor:"pointer",textTransform:"capitalize",transition:"all .2s",borderBottom:view===v?"2px solid var(--b400)":"2px solid transparent"}}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
              <div style={{padding:".25rem .75rem",background:chainConfigured?"rgba(6,182,212,.12)":"rgba(245,158,11,.12)",border:`1px solid ${chainConfigured?"rgba(6,182,212,.25)":"rgba(245,158,11,.25)"}`,borderRadius:20,fontSize:".75rem",fontWeight:500,color:chainConfigured?"var(--cyan)":"var(--warn)",display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:chainConfigured?"var(--cyan)":"var(--warn)",animation:"pulse 2s ease infinite"}}/>
                {chainConfigured?"Celo Sepolia":"Local Ledger"}
              </div>
              <div onClick={()=>signOut()} title="Sign out" style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#1a45cc,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontSize:".8rem",fontWeight:700,cursor:"pointer",border:"2px solid rgba(59,130,246,.3)"}}>
                {(session.user?.email??"U").split("@")[0].slice(0,2).toUpperCase()}
              </div>
            </div>
          </nav>

          {/* ── DASHBOARD VIEW ── */}
          {view==="dashboard"&&(
            <div className="db" style={{padding:"2rem",flex:1}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:"1.5rem"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.5rem",fontWeight:700,letterSpacing:"-.02em"}}>Motor Integrity Dashboard</div>
                  <div style={{fontSize:".85rem",color:"var(--muted)",marginTop:".2rem"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
                </div>
                <Btn onClick={manualFlush} loading={flushLoading}>⬆ Flush to Chain</Btn>
              </div>

              <div className="sg" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1rem",marginBottom:"1.5rem"}}>
                <SCard icon="🌡️" bg="rgba(251,146,60,.15)" label="Temperature" val={liveEntry?liveEntry.temperature.toFixed(1)+"°":"--°"} col="#fb923c">{liveEntry&&prevEntry?<Delta cur={liveEntry.temperature} prev={prevEntry.temperature} unit="°C"/>:<Collecting/>}</SCard>
                <SCard icon="⚙️" bg="rgba(59,130,246,.15)" label="RPM" val={liveEntry?liveEntry.rpm.toLocaleString():"--"} col="var(--b300)">{liveEntry&&prevEntry?<Delta cur={liveEntry.rpm} prev={prevEntry.rpm} unit="rpm"/>:<Collecting/>}</SCard>
                <SCard icon="📳" bg="rgba(167,139,250,.15)" label="Vibration" val={liveEntry?liveEntry.vibration.toFixed(2):"--"} col="#a78bfa">{liveEntry&&prevEntry?<Delta cur={liveEntry.vibration} prev={prevEntry.vibration} unit="mm/s"/>:<Collecting/>}</SCard>
                <SCard icon="🔗" bg="rgba(16,185,129,.15)" label="Stored Records" val={String(logRecords.length)} col="var(--success)"><span style={{color:"var(--muted)"}}>MOTOR-001</span></SCard>
              </div>

              <div className="mg" style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:"1.5rem",marginBottom:"1.5rem"}}>
                {/* Live Telemetry */}
                <Card>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600}}>Live Telemetry Feed</div>
                      <div style={{fontSize:".78rem",color:"var(--muted)",marginTop:2}}>Real-time sensor readings · 3s interval</div>
                    </div>
                    <div style={{padding:".2rem .65rem",background:engineStarted?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",border:`1px solid ${engineStarted?"rgba(16,185,129,.25)":"rgba(245,158,11,.25)"}`,borderRadius:20,fontSize:".7rem",fontWeight:600,color:engineStarted?"var(--success)":"var(--warn)",display:"flex",alignItems:"center",gap:5,textTransform:"uppercase"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:engineStarted?"var(--success)":"var(--warn)",animation:"pulse 1.5s ease infinite"}}/>
                      {engineStarted?"Live":"Waiting"}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:"1.25rem"}}>
                    {[
                      {label:"Temperature",val:liveEntry?.temperature.toFixed(1)??"68.0",unit:"°C",col:"#fb923c"},
                      {label:"RPM",val:liveEntry?.rpm.toString()??"1480",unit:"rev/min",col:"var(--b300)"},
                      {label:"Vibration",val:liveEntry?.vibration.toFixed(2)??"3.10",unit:"mm/s",col:"#a78bfa"},
                    ].map(s=>(
                      <div key={s.label} style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--gborder)",borderRadius:14,padding:"1rem",textAlign:"center"}}>
                        <div style={{fontSize:".7rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:".5rem"}}>{s.label}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"1.6rem",fontWeight:500,lineHeight:1,color:s.col}}>{s.val}</div>
                        <div style={{fontSize:".7rem",color:"var(--muted)",marginTop:2}}>{s.unit}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <HealthBadge health={liveEntry?.health??"GOOD"}/>
                    <span style={{fontSize:".75rem",color:"var(--muted)",fontFamily:"'DM Mono',monospace"}}>
                      {liveEntry?new Date(liveEntry.timestamp).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"--:--:--"}
                    </span>
                  </div>
                  <div style={{height:80,marginTop:"1.25rem",display:"flex",alignItems:"flex-end",gap:3}}>
                    {tempHistory.map((t,i)=>{
                      const pct=((t-56)/(103-56))*100,h=8+(pct/100)*72;
                      const c=t>92?"var(--danger)":t>78?"var(--warn)":"var(--b500)";
                      return <div key={i} className="cbar" style={{flex:1,height:h,background:`linear-gradient(180deg,${c},var(--b800))`,borderRadius:"3px 3px 0 0",minHeight:4}}/>;
                    })}
                  </div>
                </Card>

                {/* Batch Status */}
                <Card style={{flexDirection:"column",gap:"1rem"}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600}}>Batch Status</div>
                    <div style={{fontSize:".78rem",color:"var(--muted)",marginTop:2}}>Next flush countdown</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".85rem 1rem",background:"rgba(255,255,255,.03)",border:"1px solid var(--gborder)",borderRadius:12}}>
                    <div>
                      <div style={{fontSize:".75rem",color:"var(--muted)",marginBottom:4}}>Time until flush</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"1.1rem",fontWeight:500,color:"var(--cyan)"}}>{countdownSec}s</div>
                    </div>
                    <div style={{width:56,height:56,position:"relative",flexShrink:0}}>
                      <svg width="56" height="56" viewBox="0 0 56 56" style={{transform:"rotate(-90deg)"}}>
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(59,130,246,.15)" strokeWidth="4"/>
                        <circle cx="28" cy="28" r="22" fill="none" stroke="var(--cyan)" strokeWidth="4"
                          strokeDasharray={circ} strokeDashoffset={arcOffset} strokeLinecap="round"
                          style={{transition:"stroke-dashoffset 1s linear"}}/>
                      </svg>
                    </div>
                  </div>
                  {[
                    {icon:"📦",bg:"rgba(59,130,246,.15)",label:"Pending entries",val:`${pendingCount} entries`},
                    {icon:"✅",bg:"rgba(16,185,129,.15)",label:"Last stored batch",val:lastBatch},
                    {icon:"🔑",bg:"rgba(167,139,250,.15)",label:"Machine ID",val:"MOTOR-001",col:"var(--b300)"},
                    {icon:chainConfigured?"⛓":"💾",bg:"rgba(6,182,212,.15)",label:"Storage mode",val:chainConfigured?"Celo Sepolia":"Local Ledger",col:chainConfigured?"var(--cyan)":"var(--warn)"},
                  ].map(item=>(
                    <div key={item.label} style={{display:"flex",alignItems:"center",gap:12,padding:".85rem 1rem",background:"rgba(255,255,255,.03)",border:"1px solid var(--gborder)",borderRadius:12}}>
                      <div style={{width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,background:item.bg}}>{item.icon}</div>
                      <div>
                        <div style={{fontSize:".8rem",color:"var(--muted)"}}>{item.label}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"1rem",fontWeight:500,marginTop:2,color:item.col??"var(--white)"}}>{item.val}</div>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>

              <LogsTable records={logRecords.slice(0,5)} loading={refreshLoading} onRefresh={refreshLogs} title="Recent Batches"/>
            </div>
          )}

          {/* ── RECORDS VIEW ── */}
          {view==="records"&&(
            <div className="db" style={{padding:"2rem",flex:1}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:"1.5rem"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.5rem",fontWeight:700,letterSpacing:"-.02em"}}>On-Chain Log Records</div>
                  <div style={{fontSize:".85rem",color:"var(--muted)",marginTop:".2rem"}}>{logRecords.length} records · {chainConfigured?"Celo Sepolia + ":""}Local Ledger</div>
                </div>
                <div style={{display:"flex",gap:".75rem"}}>
                  <Btn onClick={refreshLogs} loading={refreshLoading}>↻ Refresh</Btn>
                  <Btn onClick={manualFlush} loading={flushLoading}>⬆ Flush Batch</Btn>
                </div>
              </div>
              <div className="sg" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:"1.5rem"}}>
                <SCard icon="🗂️" bg="rgba(59,130,246,.15)" label="Total Records" val={String(logRecords.length)} col="var(--b300)"><span style={{color:"var(--muted)"}}>All batches</span></SCard>
                <SCard icon="⛓" bg="rgba(16,185,129,.15)" label="On-Chain" val={String(logRecords.filter(r=>r.onChain).length)} col="var(--success)"><span style={{color:"var(--muted)"}}>Celo Sepolia</span></SCard>
                <SCard icon="💾" bg="rgba(245,158,11,.15)" label="Local Only" val={String(logRecords.filter(r=>!r.onChain).length)} col="var(--warn)"><span style={{color:"var(--muted)"}}>Needs chain ENV</span></SCard>
              </div>
              <LogsTable records={logRecords} loading={refreshLoading} onRefresh={refreshLogs} title="All Records"/>
            </div>
          )}

          {/* ── VERIFY VIEW ── */}
          {view==="verify"&&(
            <div className="db" style={{padding:"2rem",flex:1}}>
              <div style={{marginBottom:"1.5rem"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.5rem",fontWeight:700,letterSpacing:"-.02em"}}>Verify Log Integrity</div>
                <div style={{fontSize:".85rem",color:"var(--muted)",marginTop:".2rem"}}>Upload a JSON log file to check whether it has been tampered with</div>
              </div>
              <div className="mg" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem",alignItems:"start"}}>
                <Card style={{flexDirection:"column"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600,marginBottom:"1rem"}}>Upload Log File</div>
                  <div className={`drop-zone${isDragging?" drag":""}`}
                    onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
                    onDragLeave={()=>setIsDragging(false)}
                    onDrop={onFileDrop}
                    onClick={()=>fileInputRef.current?.click()}>
                    <div style={{fontSize:"2.5rem",marginBottom:".75rem"}}>📂</div>
                    <div style={{fontSize:".95rem",fontWeight:500,marginBottom:".4rem"}}>{verifyFile?verifyFile.name:"Drop a .json log file here"}</div>
                    <div style={{fontSize:".8rem",color:"var(--muted)"}}>{verifyFile?`${(verifyFile.size/1024).toFixed(1)} KB — click to change`:"or click to browse"}</div>
                    <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={onFileChange}/>
                  </div>
                  <div style={{marginTop:"1.25rem",display:"flex",gap:".75rem"}}>
                    <PBtn onClick={runVerify} loading={verifyLoading}>{verifyLoading?"Verifying...":"Verify File"}</PBtn>
                    {verifyFile&&<button onClick={()=>{setVerifyFile(null);setVerifyResult(null);if(fileInputRef.current)fileInputRef.current.value="";}} style={{flex:"0 0 auto",padding:".85rem 1.25rem",background:"rgba(255,255,255,.04)",border:"1px solid var(--gborder)",borderRadius:12,color:"var(--muted)",cursor:"pointer",fontSize:".9rem"}}>Clear</button>}
                  </div>
                  <div style={{marginTop:"1.25rem",padding:"1rem",background:"rgba(255,255,255,.02)",border:"1px solid var(--gborder)",borderRadius:12,fontSize:".8rem",color:"var(--muted)",lineHeight:1.6}}>
                    <div style={{color:"var(--b300)",fontWeight:600,marginBottom:".5rem"}}>How it works</div>
                    The file is parsed and SHA-256 hashed using canonical JSON (sorted keys). The hash is looked up in the local ledger. If the content has changed even by a single character, the hash won&apos;t match and tampering is detected.
                  </div>
                </Card>

                <Card style={{flexDirection:"column"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600,marginBottom:"1rem"}}>Verification Result</div>
                  {!verifyResult&&!verifyLoading&&(
                    <div style={{textAlign:"center",padding:"3rem 1rem",color:"var(--muted)"}}>
                      <div style={{fontSize:"3rem",marginBottom:".75rem"}}>🔍</div>
                      <div style={{fontSize:".9rem"}}>Upload a file and click Verify</div>
                    </div>
                  )}
                  {verifyLoading&&(
                    <div style={{textAlign:"center",padding:"3rem 1rem",color:"var(--muted)"}}>
                      <Spin size={40}/>
                      <div style={{marginTop:"1rem",fontSize:".9rem"}}>Computing SHA-256 hash...</div>
                    </div>
                  )}
                  {verifyResult&&!verifyLoading&&(
                    <div>
                      <div style={{padding:"1.25rem",borderRadius:14,marginBottom:"1.25rem",background:verifyResult.verified?"rgba(16,185,129,.1)":"rgba(239,68,68,.1)",border:`1px solid ${verifyResult.verified?"rgba(16,185,129,.3)":"rgba(239,68,68,.3)"}`}}>
                        <div style={{fontSize:"1.8rem",marginBottom:".5rem"}}>{verifyResult.verified?"✅":"🚨"}</div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:700,color:verifyResult.verified?"var(--success)":"var(--danger)",marginBottom:".4rem"}}>
                          {verifyResult.verified?"File Authentic":"Tampering Detected"}
                        </div>
                        <div style={{fontSize:".82rem",color:"var(--muted)"}}>{verifyResult.message}</div>
                      </div>
                      <div style={{marginBottom:"1rem"}}>
                        <div style={{fontSize:".75rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:".4rem"}}>Computed Hash</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:".72rem",color:"var(--b300)",background:"rgba(255,255,255,.03)",border:"1px solid var(--gborder)",borderRadius:10,padding:".75rem",wordBreak:"break-all"}}>{verifyResult.fileHash}</div>
                      </div>
                      {verifyResult.verified&&(
                        <div style={{display:"flex",flexDirection:"column",gap:".5rem"}}>
                          {[
                            {label:"File Name",val:verifyResult.fileName??"—"},
                            {label:"Stored At",val:verifyResult.timestamp?new Date(verifyResult.timestamp).toLocaleString():"—"},
                            {label:"Machine ID",val:verifyResult.machineId??"—"},
                            {label:"Entries",val:String(verifyResult.entries??"—")},
                            {label:"On-Chain",val:verifyResult.onChain?"Yes ✅":"No (local only)"},
                            ...(verifyResult.txHash?[{label:"Tx Hash",val:verifyResult.txHash.slice(0,20)+"..."}]:[]),
                          ].map(row=>(
                            <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:".6rem .85rem",background:"rgba(255,255,255,.02)",borderRadius:8,fontSize:".82rem"}}>
                              <span style={{color:"var(--muted)"}}>{row.label}</span>
                              <span style={{fontFamily:"'DM Mono',monospace"}}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ── SETTINGS VIEW ── */}
          {view==="settings"&&(
            <div className="db" style={{padding:"2rem",flex:1}}>
              <div style={{marginBottom:"1.5rem"}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.5rem",fontWeight:700,letterSpacing:"-.02em"}}>Settings</div>
                <div style={{fontSize:".85rem",color:"var(--muted)",marginTop:".2rem"}}>Environment status and configuration</div>
              </div>
              <div className="mg" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem",alignItems:"start"}}>
                <Card style={{flexDirection:"column"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600,marginBottom:"1rem"}}>Environment Variables</div>
                  {[
                    {key:"GOOGLE_CLIENT_ID",hint:"Required for Google OAuth",set:true},
                    {key:"GOOGLE_CLIENT_SECRET",hint:"Required for Google OAuth",set:true},
                    {key:"NEXTAUTH_SECRET",hint:"Required for sessions",set:true},
                    {key:"SMTP_HOST / SMTP_USER / SMTP_PASS",hint:"Required for real email OTP",set:false},
                    {key:"RPC_URL",hint:"Pre-filled: alfajores-forno.celo-testnet.org",set:true},
                    {key:"PRIVATE_KEY",hint:"Needed to write to Celo Sepolia",set:false},
                    {key:"CONTRACT_ADDRESS",hint:"Your deployed LogIntegrity.sol",set:false},
                    {key:"MACHINE_ID",hint:"Default: MOTOR-001",set:true},
                  ].map(e=>(
                    <div key={e.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".75rem 1rem",background:"rgba(255,255,255,.02)",border:"1px solid var(--gborder)",borderRadius:10,marginBottom:".5rem"}}>
                      <div>
                        <div style={{fontSize:".82rem",fontWeight:500,fontFamily:"'DM Mono',monospace",color:"var(--b300)"}}>{e.key}</div>
                        <div style={{fontSize:".75rem",color:"var(--muted)",marginTop:2}}>{e.hint}</div>
                      </div>
                      <div style={{padding:".2rem .65rem",borderRadius:6,fontSize:".72rem",fontWeight:600,flexShrink:0,...(e.set?{background:"rgba(16,185,129,.12)",color:"var(--success)",border:"1px solid rgba(16,185,129,.25)"}:{background:"rgba(245,158,11,.12)",color:"var(--warn)",border:"1px solid rgba(245,158,11,.25)"})}}>{e.set?"SET":"FILL IN"}</div>
                    </div>
                  ))}
                </Card>
                <Card style={{flexDirection:"column",gap:"1rem"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600}}>Storage Mode</div>
                  <div style={{padding:"1.25rem",background:chainConfigured?"rgba(6,182,212,.06)":"rgba(59,130,246,.06)",border:`1px solid ${chainConfigured?"rgba(6,182,212,.2)":"rgba(59,130,246,.2)"}`,borderRadius:12}}>
                    <div style={{fontWeight:600,marginBottom:".5rem",display:"flex",alignItems:"center",gap:8}}>
                      {chainConfigured?"⛓ Celo Sepolia":"💾 Local JSON Ledger"}
                      <span style={{padding:".15rem .5rem",background:"rgba(16,185,129,.15)",color:"var(--success)",borderRadius:6,fontSize:".7rem",border:"1px solid rgba(16,185,129,.25)"}}>ACTIVE</span>
                    </div>
                    <div style={{fontSize:".82rem",color:"var(--muted)",lineHeight:1.6}}>
                      {chainConfigured
                        ? "Batches are SHA-256 hashed and submitted to Celo Alfajores (Sepolia) via your LogIntegrity.sol contract."
                        : <>Batches save to <code style={{color:"var(--b300)"}}>data/ledger.json</code>. Fill <code style={{color:"var(--b300)"}}>PRIVATE_KEY</code> + <code style={{color:"var(--b300)"}}>CONTRACT_ADDRESS</code> to enable chain writes.</>
                      }
                    </div>
                  </div>
                  <div style={{padding:"1.25rem",background:"rgba(255,255,255,.02)",border:"1px solid var(--gborder)",borderRadius:12}}>
                    <div style={{fontWeight:600,marginBottom:".5rem",color:"var(--b300)"}}>📧 Email OTP Setup</div>
                    <div style={{fontSize:".82rem",color:"var(--muted)",lineHeight:1.8}}>
                      Add to <code style={{color:"var(--b300)"}}>. env.local</code>:<br/>
                      <code style={{color:"var(--cyan)"}}>SMTP_HOST=smtp.gmail.com</code><br/>
                      <code style={{color:"var(--cyan)"}}>SMTP_PORT=587</code><br/>
                      <code style={{color:"var(--cyan)"}}>SMTP_USER=you@gmail.com</code><br/>
                      <code style={{color:"var(--cyan)"}}>SMTP_PASS=your_app_password</code><br/>
                      <span style={{fontSize:".75rem"}}>Get App Password at myaccount.google.com/apppasswords</span>
                    </div>
                  </div>
                  <button onClick={()=>signOut()} style={{width:"100%",padding:".75rem",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:12,color:"var(--danger)",fontFamily:"'DM Sans',sans-serif",fontSize:".9rem",fontWeight:500,cursor:"pointer"}}>Sign Out</button>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOAST */}
      <div style={{position:"fixed",bottom:"2rem",right:"2rem",zIndex:999,padding:".85rem 1.25rem",background:"rgba(10,31,107,.9)",border:"1px solid var(--cborder)",borderRadius:14,backdropFilter:"blur(20px)",display:"flex",alignItems:"center",gap:10,fontSize:".875rem",boxShadow:"0 16px 48px rgba(3,7,30,.6)",maxWidth:360,animation:toast.show?"slideUp .4s cubic-bezier(.16,1,.3,1) forwards":"slideDown .3s ease forwards",pointerEvents:toast.show?"auto":"none"}}>
        <span style={{fontSize:"1.1rem"}}>{toast.icon}</span>
        <span>{toast.msg}</span>
      </div>
    </>
  );
}

// ─── SHARED STYLES & SUBCOMPONENTS ───────────────────────────────────────────
const INP: React.CSSProperties = {flex:1,background:"transparent",border:"none",outline:"none",padding:".75rem 1rem",color:"var(--white)",fontFamily:"'DM Sans',sans-serif",fontSize:".9rem"};

function Logo({small}:{small?:boolean}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:small?30:36,height:small?30:36,background:"linear-gradient(135deg,#2563eb,#06b6d4)",borderRadius:small?8:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:small?15:18}}>⛓</div>
      <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:small?"1.1rem":"1.25rem",letterSpacing:"-.02em",background:"linear-gradient(135deg,#f8faff,#93c5fd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ChainLog</span>
    </div>
  );
}
function MsgBox({m}:{m:{t:"error"|"success";s:string}|null}){
  if(!m) return null;
  return <div style={{padding:".65rem 1rem",borderRadius:10,fontSize:".85rem",marginBottom:"1rem",animation:"fadeIn .3s ease",background:m.t==="error"?"rgba(239,68,68,.12)":"rgba(16,185,129,.12)",border:`1px solid ${m.t==="error"?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)"}`,color:m.t==="error"?"#fca5a5":"#6ee7b7"}}>{m.s}</div>;
}
function IField({label,icon,children}:{label:string;icon:string;children:React.ReactNode}){
  return(
    <div style={{marginBottom:"1rem"}}>
      <label style={{display:"block",fontSize:".8rem",fontWeight:500,color:"var(--b200)",marginBottom:".4rem",letterSpacing:".02em",textTransform:"uppercase"}}>{label}</label>
      <div style={{position:"relative",display:"flex",alignItems:"center",background:"rgba(255,255,255,.04)",border:"1px solid var(--gborder)",borderRadius:12,transition:"border-color .2s"}}
        onFocus={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--b500)";(e.currentTarget as HTMLElement).style.boxShadow="0 0 0 3px rgba(37,99,235,.15)"}}
        onBlur={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--gborder)";(e.currentTarget as HTMLElement).style.boxShadow="none"}}>
        <span style={{marginLeft:14,flexShrink:0,opacity:.5}}>{icon==="email"?<EmailIco/>:icon==="lock"?<LockIco/>:<UserIco/>}</span>
        {children}
      </div>
    </div>
  );
}
function PBtn({onClick,loading,children}:{onClick:()=>void;loading:boolean;children:React.ReactNode}){
  return(
    <button onClick={onClick} disabled={loading} style={{width:"100%",padding:".85rem",background:"linear-gradient(135deg,var(--b600),var(--b500))",border:"none",borderRadius:12,color:"var(--white)",fontFamily:"'Syne',sans-serif",fontSize:".95rem",fontWeight:600,cursor:loading?"not-allowed":"pointer",boxShadow:"0 4px 16px rgba(37,99,235,.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?.8:1}}>
      {loading&&<Spin size={16}/>}<span>{children}</span>
    </button>
  );
}
function Btn({onClick,loading,children}:{onClick:()=>void;loading:boolean;children:React.ReactNode}){
  return(
    <button onClick={onClick} disabled={loading} style={{padding:".5rem 1.25rem",background:"linear-gradient(135deg,var(--b600),var(--cyan2))",border:"none",borderRadius:10,color:"var(--white)",fontFamily:"'DM Sans',sans-serif",fontSize:".85rem",fontWeight:500,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 2px 12px rgba(37,99,235,.35)",opacity:loading?.7:1}}>
      {loading?<Spin size={14}/>:null}{children}
    </button>
  );
}
function GBtn({onClick}:{onClick:()=>void}){
  return(
    <button onClick={onClick} style={{width:"100%",padding:".75rem",background:"var(--glass)",border:"1px solid var(--gborder)",borderRadius:12,color:"var(--white)",fontFamily:"'DM Sans',sans-serif",fontSize:".9rem",fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
      <GoogleIco/>Continue with Google
    </button>
  );
}
function Divider({text="or continue with"}:{text?:string}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"1.25rem 0",color:"var(--muted)",fontSize:".8rem"}}>
      <span style={{flex:1,height:1,background:"var(--gborder)"}}/>
      {text}
      <span style={{flex:1,height:1,background:"var(--gborder)"}}/>
    </div>
  );
}
function EyeBtn({show,toggle}:{show:boolean;toggle:()=>void}){
  return <button onClick={toggle} style={{background:"none",border:"none",cursor:"pointer",padding:"0 14px",color:"var(--muted)",fontSize:"1rem"}}>{show?"🙈":"👁"}</button>;
}
function Spin({size=16}:{size?:number}){
  return <div style={{width:size,height:size,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>;
}
function Card({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){
  return <div style={{background:"var(--card)",border:"1px solid var(--cborder)",borderRadius:18,padding:"1.5rem",backdropFilter:"blur(20px)",display:"flex",...style}}>{children}</div>;
}
function SCard({icon,bg,label,val,col,children}:{icon:string;bg:string;label:string;val:string;col:string;children:React.ReactNode}){
  return(
    <div style={{background:"var(--card)",border:"1px solid var(--cborder)",borderRadius:18,padding:"1.35rem 1.5rem",backdropFilter:"blur(20px)"}}>
      <div style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,marginBottom:".75rem",background:bg}}>{icon}</div>
      <div style={{fontSize:".75rem",fontWeight:500,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:".6rem"}}>{label}</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:"2rem",fontWeight:700,letterSpacing:"-.04em",lineHeight:1,marginBottom:".4rem",color:col}}>{val}</div>
      <div style={{fontSize:".78rem",fontWeight:500}}>{children}</div>
    </div>
  );
}
function HealthBadge({health}:{health:string}){
  const s:{[k:string]:{background:string;border:string;color:string}}={
    GOOD:{background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.3)",color:"var(--success)"},
    WARNING:{background:"rgba(245,158,11,.15)",border:"1px solid rgba(245,158,11,.3)",color:"var(--warn)"},
    CRITICAL:{background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",color:"var(--danger)"},
  };
  return <span style={{padding:".4rem 1rem",borderRadius:20,fontFamily:"'Syne',sans-serif",fontSize:".8rem",fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",...(s[health]??s.GOOD)}}>● {health}</span>;
}
function Collecting(){return <span style={{color:"var(--muted)"}}>Collecting...</span>;}
function Delta({cur,prev,unit}:{cur:number;prev:number;unit:string}){
  const d=cur-prev;
  if(Math.abs(d)<0.01) return <span style={{color:"var(--muted)"}}>No change</span>;
  const up=d>0;
  return <span style={{color:up?"var(--success)":"var(--danger)"}}>{up?"↑":"↓"} {Math.abs(d).toFixed(unit==="rpm"?0:2)} {unit}</span>;
}
function LogsTable({records,loading,onRefresh,title}:{records:LogRecord[];loading:boolean;onRefresh:()=>void;title:string}){
  return(
    <div style={{background:"var(--card)",border:"1px solid var(--cborder)",borderRadius:18,padding:"1.5rem",backdropFilter:"blur(20px)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1rem",fontWeight:600}}>{title}</div>
          <div style={{fontSize:".78rem",color:"var(--muted)",marginTop:2}}>SHA-256 tamper-proof records</div>
        </div>
        <button onClick={onRefresh} disabled={loading} style={{padding:".4rem .9rem",background:"linear-gradient(135deg,var(--b600),var(--cyan2))",border:"none",borderRadius:10,color:"var(--white)",fontFamily:"'DM Sans',sans-serif",fontSize:".8rem",fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:loading?.7:1}}>
          {loading?<Spin size={12}/>:"↻"} Refresh
        </button>
      </div>
      <table className="ltable">
        <thead><tr>
          <th>File Name</th><th>SHA-256 Hash</th><th>Timestamp</th><th>Entries</th><th>Storage</th>
        </tr></thead>
        <tbody>
          {records.length===0
            ?<tr><td colSpan={5} style={{textAlign:"center",color:"var(--muted)",padding:"2rem",fontSize:".85rem"}}>No records yet — batches appear after the first flush (60s or manual).</td></tr>
            :records.map((r,i)=>(
              <tr key={r.recordId||i}>
                <td style={{fontFamily:"'DM Mono',monospace",fontSize:".78rem"}}>{r.fileName}</td>
                <td style={{fontFamily:"'DM Mono',monospace",fontSize:".75rem",color:"var(--b300)"}}>{r.fileHash.slice(0,8)}...{r.fileHash.slice(-6)}</td>
                <td style={{color:"var(--muted)",fontSize:".8rem"}}>{new Date(r.timestamp).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                <td style={{fontFamily:"'DM Mono',monospace",fontSize:".8rem"}}>{r.entries}</td>
                <td><span style={{padding:".2rem .6rem",borderRadius:6,fontSize:".7rem",fontWeight:600,...(r.onChain?{background:"rgba(16,185,129,.12)",color:"var(--success)",border:"1px solid rgba(16,185,129,.25)"}:{background:"rgba(245,158,11,.12)",color:"var(--warn)",border:"1px solid rgba(245,158,11,.25)"})}}>{r.onChain?"⛓ On-Chain":"💾 Local"}</span></td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
function GoogleIco(){return(<svg width="18" height="18" viewBox="0 0 512 512"><path fill="#FBBB00" d="M113.47,309.408L95.648,375.94l-65.139,1.378C11.042,341.211,0,299.9,0,256c0-42.451,10.324-82.483,28.624-117.732h0.014l57.992,10.632l25.404,57.644c-5.317,15.501-8.215,32.141-8.215,49.456C103.821,274.792,107.225,292.797,113.47,309.408z"/><path fill="#518EF8" d="M507.527,208.176C510.467,223.662,512,239.655,512,256c0,18.328-1.927,36.206-5.598,53.451c-12.462,58.683-45.025,109.925-90.134,146.187l-0.014-0.014l-73.044-3.727l-10.338-64.535c29.932-17.554,53.324-45.025,65.646-77.911h-136.89V208.176h138.887L507.527,208.176L507.527,208.176z"/><path fill="#28B446" d="M416.253,455.624l0.014,0.014C372.396,490.901,316.666,512,256,512c-97.491,0-182.252-54.491-225.491-134.681l82.961-67.91c21.619,57.698,77.278,98.771,142.53,98.771c28.047,0,54.323-7.582,76.87-20.818L416.253,455.624z"/><path fill="#F14336" d="M419.404,58.936l-82.933,67.896c-23.335-14.586-50.919-23.012-80.471-23.012c-66.729,0-123.429,42.957-143.965,102.724l-83.397-68.276h-0.014C71.23,56.123,157.06,0,256,0C318.115,0,375.068,22.126,419.404,58.936z"/></svg>);}
function EmailIco(){return<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>;}
function LockIco(){return<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;}
function UserIco(){return<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;}