import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GraduationCap, Lock, User, Eye, EyeOff, AlertCircle, RotateCcw, Smartphone } from "lucide-react";
import { Student, Faculty, Session, NotificationLog, HolidayEvent, BroadcastTemplate, SettingsConfig, BatchSchedule } from "./types";
import {
  INITIAL_TEMPLATES,
  INITIAL_SETTINGS
} from "./data/mockData";
import { saveSession, loadSession, clearSession } from "./services/storage";
import AdminPortal from "./views/AdminPortal";
import FacultyPortal from "./views/FacultyPortal";

// Login mode: admin uses username+password; faculty uses phone+OTP
type LoginMode = 'admin' | 'faculty';

export default function App() {
  const existingSession = loadSession();
  
  const [currentRole, setCurrentRole] = useState<'login' | 'admin' | 'faculty'>(
    existingSession?.role === 'admin' ? 'admin' :
    existingSession?.role === 'faculty' ? 'faculty' : 'login'
  );
  const [loggedInUser, setLoggedInUser] = useState<{ displayName: string; role: 'admin' | 'faculty'; token?: string } | null>(
    existingSession ?? null
  );

  // Login form state
  const [loginMode, setLoginMode] = useState<LoginMode>('admin');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);


  // OTP state (faculty login)
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // App data states
  const [students, setStudents] = useState<Student[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [holidays, setHolidays] = useState<HolidayEvent[]>([]);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>(INITIAL_TEMPLATES);
  const [settings, setSettings] = useState<SettingsConfig>(INITIAL_SETTINGS);

  useEffect(() => {
    if (!loggedInUser) return;
    Promise.all([
      fetch("/api/students").then(r => r.json()),
      fetch("/api/faculty").then(r => r.json()),
      fetch("/api/sessions").then(r => r.json()),
      fetch("/api/notificationLogs").then(r => r.json()),
      fetch("/api/holidays").then(r => r.json()),
      fetch("/api/settings").then(r => r.json())
    ])
    .then(([stds, fac, sess, logs, hols, sets]) => {
      setStudents(stds);
      setFaculty(fac);
      setSessions(sess);
      setNotificationLogs(logs);
      setHolidays(hols);
      setSettings(sets);
    })
    .catch(err => console.error("Failed to load initial data:", err));
  }, [loggedInUser]);

  const processedStudents = useMemo(() => {
    const rule = settings.rules?.excusedAbsenceRule || 'Excluded';
    return students.map(s => {
      const { present, total, excused = 0 } = s.stats;
      let rate = 100.0;
      if (total > 0) {
        if (rule === 'Excluded') {
          const active = total - excused;
          rate = active > 0 ? parseFloat(((present / active) * 100).toFixed(1)) : 100.0;
        } else {
          rate = parseFloat(((present / total) * 100).toFixed(1));
        }
      }
      return { ...s, attendancePercentage: rate };
    });
  }, [students, settings.rules?.excusedAbsenceRule]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (loggedInUser?.token) h["Authorization"] = `Bearer ${loggedInUser.token}`;
    return h;
  }, [loggedInUser]);

  // ── Settings ──────────────────────────────────────────────────────────────
  const handleUpdateSettings = useCallback((s: SettingsConfig) => {
    fetch("/api/settings", { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(s) })
      .then(r => r.json()).then(setSettings).catch(console.error);
  }, [getAuthHeaders]);

  // ── Students ──────────────────────────────────────────────────────────────
  const handleAddStudent = useCallback((s: Student) => {
    fetch("/api/students", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(s) })
      .then(r => r.json()).then(d => setStudents(p => [d, ...p])).catch(console.error);
  }, [getAuthHeaders]);

  const handleImportStudents = useCallback((newStds: Student[]) => {
    setSettings(cur => {
      const existing = cur.batchSchedules.map(b => b.batchId);
      const newBatches: BatchSchedule[] = [];
      newStds.forEach(s => {
        if (!existing.includes(s.batchId) && !newBatches.some(nb => nb.batchId === s.batchId)) {
          newBatches.push({ batchId: s.batchId, batchName: s.batch, batchTag: s.batch.split(" ").slice(-1)[0] || "Class", activeDays: [1, 3, 5] });
        }
      });
      const updated = newBatches.length > 0
        ? { ...cur, batchSchedules: [...cur.batchSchedules, ...newBatches] }
        : cur;
      setStudents(prev => {
        const newNames = newStds.map(s => s.name.trim().toLowerCase());
        const merged = [...newStds, ...prev.filter(s => !newNames.includes(s.name.trim().toLowerCase()))];
        const calls = [fetch("/api/students", { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(merged) })];
        if (newBatches.length > 0) calls.push(fetch("/api/settings", { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(updated) }));
        Promise.all(calls).catch(console.error);
        return merged;
      });
      return updated;
    });
  }, [getAuthHeaders]);

  const handleUpdateStudents = useCallback((list: Student[]) => {
    fetch("/api/students", { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(list) })
      .then(r => r.json()).then(setStudents).catch(console.error);
  }, [getAuthHeaders]);

  // ── Faculty ───────────────────────────────────────────────────────────────
  const handleAddFaculty = useCallback((f: Faculty) => {
    fetch("/api/faculty", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(f) })
      .then(r => r.json()).then(d => setFaculty(p => [d, ...p])).catch(console.error);
  }, [getAuthHeaders]);

  const handleUpdateFaculty = useCallback((id: string, updates: Partial<Faculty>) => {
    fetch(`/api/faculty/${id}`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(updates) })
      .then(r => r.json())
      .then(u => setFaculty(p => p.map(f => f.id === id ? { ...f, ...u } : f)))
      .catch(console.error);
  }, [getAuthHeaders]);

  const handleDeleteFaculty = useCallback((id: string) => {
    const h: Record<string, string> = {};
    if (loggedInUser?.token) h["Authorization"] = `Bearer ${loggedInUser.token}`;
    fetch(`/api/faculty/${id}`, { method: "DELETE", headers: h })
      .then(() => setFaculty(p => p.filter(f => f.id !== id)))
      .catch(console.error);
  }, [loggedInUser]);

  // ── Sessions ──────────────────────────────────────────────────────────────
  const handleUpdateSessions = useCallback((list: Session[]) => {
    fetch("/api/sessions", { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(list) })
      .then(r => r.json()).then(setSessions).catch(console.error);
  }, [getAuthHeaders]);

  // ── Holidays ──────────────────────────────────────────────────────────────
  const handleAddHoliday = useCallback((h: HolidayEvent) => {
    fetch("/api/holidays", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(h) })
      .then(r => r.json()).then(d => setHolidays(p => [d, ...p])).catch(console.error);
  }, [getAuthHeaders]);

  const handleDeleteHoliday = useCallback((id: string) => {
    const h: Record<string, string> = {};
    if (loggedInUser?.token) h["Authorization"] = `Bearer ${loggedInUser.token}`;
    fetch(`/api/holidays/${id}`, { method: "DELETE", headers: h })
      .then(() => setHolidays(p => p.filter(hol => hol.id !== id)))
      .catch(console.error);
  }, [loggedInUser]);

  // ── Notifications ─────────────────────────────────────────────────────────
  const handleSendBroadcast = useCallback((newLogs: NotificationLog[]) => {
    fetch("/api/notificationLogs", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(newLogs) })
      .then(r => r.json())
      .then(d => setNotificationLogs(p => [...(Array.isArray(d) ? d : [d]), ...p]))
      .catch(console.error);
  }, [getAuthHeaders]);

  const handleUpdateSessionStatus = useCallback((
    sessionId: string,
    presentCount: number,
    absentCount: number,
    updatedStudents: Student[],
    newLogs: NotificationLog[]
  ) => {
    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          status: 'Marked' as const,
          presentCount,
          absentCount,
          markedBy: loggedInUser?.displayName || "Faculty"
        };
      }
      return s;
    });

    handleUpdateSessions(updatedSessions);
    handleUpdateStudents(updatedStudents);
    if (newLogs.length > 0) {
      handleSendBroadcast(newLogs);
    }
  }, [sessions, loggedInUser, handleUpdateSessions, handleUpdateStudents, handleSendBroadcast]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    setCurrentRole('login');
    setLoggedInUser(null);
    setUsername(""); setPassword(""); setLoginError("");
    setOtpPhone(""); setOtpCode(""); setOtpSent(false); setDevOtp(null);
    clearSession();
  }, []);

  // Admin username+password login
  const handleAdminLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!username.trim() || !password.trim()) {
      setLoginError("Please enter your username and password.");
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Invalid credentials"); }
      const data = await res.json();
      const sess = { ...data.user, token: data.token };
      setLoggedInUser(sess);
      setCurrentRole('admin');
      saveSession(sess);
    } catch (err: any) {
      setLoginError(err.message || "Authentication failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }, [username, password]);

  // Faculty OTP step 1: request OTP
  const handleRequestOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!otpPhone.trim()) { setLoginError("Please enter your phone number."); return; }
    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setOtpSent(true);
      if (data.mockOtp) setDevOtp(data.mockOtp); // dev only
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsSendingOtp(false);
    }
  }, [otpPhone]);

  // Faculty OTP step 2: verify OTP
  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!otpCode.trim()) { setLoginError("Please enter the OTP."); return; }
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone.trim(), otp: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed");
      const sess = { ...data.user, token: data.token };
      setLoggedInUser(sess);
      setCurrentRole('faculty');
      saveSession(sess);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  }, [otpPhone, otpCode]);



  return (
    <div className="min-h-screen bg-[#f7fafc] flex flex-col font-sans select-none" id="app_root_container">
      <AnimatePresence mode="wait">

        {/* ===== LOGIN PAGE ===== */}
        {currentRole === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="flex-1 min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#001d3d] via-[#002f5c] to-[#003566]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(30,115,190,0.15),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,124,65,0.1),transparent_60%)]" />
            <div className="absolute top-20 right-40 w-72 h-72 bg-primary/8 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-32 left-32 w-56 h-56 bg-emerald-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

            <div className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-md">

              {/* Branding */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-3xl font-black font-display text-white tracking-tight">
                    Infinity Scholar's Hub
                  </h1>
                  <p className="text-sm text-sky-200/70 font-medium">
                    Attendance Management System
                  </p>
                </div>
              </motion.div>

              {/* Mode toggle */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.4 }}
                className="w-full bg-white/[0.06] rounded-xl p-1 flex gap-1"
              >
                <button
                  onClick={() => { setLoginMode('admin'); setLoginError(""); setOtpSent(false); setDevOtp(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginMode === 'admin' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" /> Admin
                </button>
                <button
                  onClick={() => { setLoginMode('faculty'); setLoginError(""); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginMode === 'faculty' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Faculty (OTP)
                </button>
              </motion.div>

              {/* ── Admin Login Form ── */}
              {loginMode === 'admin' && (
                <motion.form
                  key="admin-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleAdminLogin}
                  className="w-full bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-7 flex flex-col gap-5"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-sky-200/60 uppercase tracking-wider">Username</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={e => { setUsername(e.target.value); setLoginError(""); }}
                        placeholder="admin"
                        className="w-full bg-white/[0.06] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:bg-white/[0.08] transition-all"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-sky-200/60 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setLoginError(""); }}
                        placeholder="••••••••••"
                        className="w-full bg-white/[0.06] border border-white/10 rounded-xl py-3 pl-10 pr-11 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:bg-white/[0.08] transition-all"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-xs font-semibold text-red-300">{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-display font-bold text-sm rounded-xl transition-all disabled:opacity-60 cursor-pointer disabled:cursor-wait flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {isLoggingIn ? (
                      <><svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Signing in...</>
                    ) : "Sign In to Admin Portal"}
                  </button>
                </motion.form>
              )}

              {/* ── Faculty OTP Login ── */}
              {loginMode === 'faculty' && (
                <motion.div
                  key="faculty-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-7 flex flex-col gap-5"
                >
                  {!otpSent ? (
                    <form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1.5 text-center">
                        <p className="text-sm font-bold text-white">Faculty Login</p>
                        <p className="text-xs text-sky-200/50">Enter the phone number your admin registered for you.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-sky-200/60 uppercase tracking-wider">Registered Phone Number</label>
                        <div className="relative">
                          <Smartphone className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={otpPhone}
                            onChange={e => { setOtpPhone(e.target.value); setLoginError(""); }}
                            placeholder="9999900000"
                            className="w-full bg-white/[0.06] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:bg-white/[0.08] transition-all"
                          />
                        </div>
                      </div>
                      {loginError && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="text-xs font-semibold text-red-300">{loginError}</span>
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSendingOtp}
                        className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-display font-bold text-sm rounded-xl transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSendingOtp ? "Sending OTP..." : "Send OTP"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1.5 text-center">
                        <p className="text-sm font-bold text-white">Enter OTP</p>
                        <p className="text-xs text-sky-200/50">OTP sent to <span className="font-mono text-sky-300">{otpPhone}</span></p>
                        {devOtp && (
                          <p className="text-[10px] font-mono bg-white/5 rounded-lg py-1.5 px-3 text-amber-300 mt-1">
                            Dev OTP: <strong>{devOtp}</strong>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-sky-200/60 uppercase tracking-wider">6-Digit OTP</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpCode}
                          onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setLoginError(""); }}
                          placeholder="000000"
                          className="w-full bg-white/[0.06] border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:bg-white/[0.08] transition-all text-center tracking-widest font-mono text-lg"
                        />
                      </div>
                      {loginError && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="text-xs font-semibold text-red-300">{loginError}</span>
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-display font-bold text-sm rounded-xl transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isLoggingIn ? "Verifying..." : "Verify & Sign In"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpCode(""); setDevOtp(null); setLoginError(""); }}
                        className="text-xs text-sky-300/50 hover:text-sky-300/80 text-center cursor-pointer transition-colors"
                      >
                        ← Change phone number
                      </button>
                    </form>
                  )}
                </motion.div>
              )}


            </div>
          </motion.div>
        )}

        {/* ===== ADMIN PORTAL ===== */}
        {currentRole === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex">
            <div className="flex-1 overflow-x-hidden">
              <AdminPortal
                students={processedStudents}
                faculty={faculty}
                sessions={sessions}
                notificationLogs={notificationLogs}
                holidays={holidays}
                templates={templates}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onAddStudent={handleAddStudent}
                onImportStudents={handleImportStudents}
                onAddHoliday={handleAddHoliday}
                onDeleteHoliday={handleDeleteHoliday}
                onSendBroadcast={handleSendBroadcast}
                onUpdateStudents={handleUpdateStudents}
                onUpdateSessions={handleUpdateSessions}
                onAddFaculty={handleAddFaculty}
                onUpdateFaculty={handleUpdateFaculty}
                onDeleteFaculty={handleDeleteFaculty}
                onSignOut={handleSignOut}
                adminName={loggedInUser?.displayName || "Administrator"}
              />
            </div>
          </motion.div>
        )}

        {/* ===== FACULTY PORTAL ===== */}
        {currentRole === 'faculty' && (
          <motion.div key="faculty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex">
            <div className="flex-1 overflow-x-hidden">
              <FacultyPortal
                students={processedStudents}
                sessions={sessions}
                onUpdateSessionStatus={handleUpdateSessionStatus}
                onSignOut={handleSignOut}
                facultyName={loggedInUser?.displayName || "Faculty"}
              />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
