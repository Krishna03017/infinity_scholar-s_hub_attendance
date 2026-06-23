import React, { useState } from "react";
import { CheckCircle, AlertCircle, Clock, ChevronRight, Check, X, ArrowLeft, Send, Sparkles, History } from "lucide-react";
import { Student, Session, NotificationLog } from "../types";

interface FacultyPortalProps {
  students: Student[];
  sessions: Session[];
  facultyName: string;
  onUpdateSessionStatus: (sessionId: string, presentCount: number, absentCount: number, updatedStudents: Student[], newLogs: NotificationLog[]) => void;
  onSignOut: () => void;
}

export default function FacultyPortal({ students, sessions, facultyName, onUpdateSessionStatus, onSignOut }: FacultyPortalProps) {
  const [activeView, setActiveView] = useState<'sessions' | 'marking' | 'success'>('sessions');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // Roster attendance state mapping: studentId -> 'Present' | 'Absent'
  const [attendanceSheet, setAttendanceSheet] = useState<Record<string, 'Present' | 'Absent'>>({});
  const [successStats, setSuccessStats] = useState<{ total: number; present: number; absent: number } | null>(null);

  // Sub-tab under Sessions tab (Today's Scheduled vs Completed Logs)
  const [historyTab, setHistoryTab] = useState<'scheduled' | 'history'>('scheduled');

  // Filter sessions assigned ONLY to this faculty today
  const activeSessions = sessions.filter(s => s.assignedFaculty === facultyName && s.status !== 'Marked');
  const markedSessions = sessions.filter(s => s.assignedFaculty === facultyName && s.status === 'Marked');

  // Initialize marking sheet for a session
  const startMarkingAttendance = (session: Session) => {
    setSelectedSession(session);
    
    // Filter matching student roster
    const batchStudents = students.filter(s => s.batchId === session.batchId);
    
    // Set initial toggle state: everyone is Present by default
    const initialSheet: Record<string, 'Present' | 'Absent'> = {};
    batchStudents.forEach(s => {
      initialSheet[s.id] = 'Present';
    });
    
    setAttendanceSheet(initialSheet);
    setActiveView('marking');
  };

  const handleToggleAttendance = (studentId: string, status: 'Present' | 'Absent') => {
    setAttendanceSheet(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleToggleAll = (status: 'Present' | 'Absent') => {
    if (!selectedSession) return;
    const batchStudents = students.filter(s => s.batchId === selectedSession.batchId);
    const updatedSheet: Record<string, 'Present' | 'Absent'> = {};
    batchStudents.forEach(s => {
      updatedSheet[s.id] = status;
    });
    setAttendanceSheet(updatedSheet);
  };

  const handleSubmitAttendance = () => {
    if (!selectedSession) return;

    const batchStudents = students.filter(s => s.batchId === selectedSession.batchId);
    let present = 0;
    let absent = 0;

    // Build list of modified students with updated averages and histories
    const newStudentsList = students.map(s => {
      if (s.batchId === selectedSession.batchId) {
        const markedState = attendanceSheet[s.id] || 'Present';
        const isPresentFlag = markedState === 'Present';
        
        if (isPresentFlag) present++;
        else absent++;

        // Add history record for today
        const historyId = `h_fac_${Date.now()}_${s.id}`;
        const newRecord = {
          id: historyId,
          date: new Date().toISOString().split('T')[0],
          time: selectedSession.time.split(" - ")[0],
          subject: selectedSession.subject.split(" • ")[0],
          status: markedState,
          markedBy: facultyName
        };

        const updatedHistory = [newRecord, ...s.history];
        const updatedTotal = s.stats.total + 1;
        const updatedPresent = s.stats.present + (isPresentFlag ? 1 : 0);
        const updatedAbsent = s.stats.absent + (!isPresentFlag ? 1 : 0);
        const updatedPercentage = parseFloat(((updatedPresent / updatedTotal) * 100).toFixed(1));

        return {
          ...s,
          stats: {
            ...s.stats,
            total: updatedTotal,
            present: updatedPresent,
            absent: updatedAbsent
          },
          attendancePercentage: updatedPercentage,
          history: updatedHistory
        };
      }
      return s;
    });

    // Generate mock parent notification logs for all absent students
    const newLogs: NotificationLog[] = [];
    batchStudents.forEach(student => {
      const markedState = attendanceSheet[student.id];
      if (markedState === 'Absent') {
        newLogs.push({
          id: `fac_abs_log_${Date.now()}_${student.id}`,
          recipient: `${student.parentName} (F/o ${student.name})`,
          channel: 'whatsapp',
          status: 'Delivered',
          message: `Dear parent, ${student.name} was ABSENT from ${selectedSession.batchName} ${selectedSession.subject} session scheduled today. Your ward's attendance index is below critical. Please contact the administration for guidance.`,
          timestamp: new Date().toISOString().split('T')[0] + " " + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        });
      }
    });

    // Dispatch states up to App component
    onUpdateSessionStatus(selectedSession.id, present, absent, newStudentsList, newLogs);
    
    setSuccessStats({ total: batchStudents.length, present, absent });
    setActiveView('success');
  };

  // Compute calculated metrics for active roster
  const getMarkingMetrics = () => {
    if (!selectedSession) return { total: 0, presentCount: 0, absentCount: 0, percentage: 0 };
    const batchStudents = students.filter(s => s.batchId === selectedSession.batchId);
    const total = batchStudents.length;
    
    let presentCount = 0;
    batchStudents.forEach(s => {
      if (attendanceSheet[s.id] === 'Present') {
        presentCount++;
      }
    });

    return {
      total,
      presentCount,
      absentCount: total - presentCount,
      percentage: total > 0 ? Math.round((presentCount / total) * 100) : 0
    };
  };

  const markingMetrics = getMarkingMetrics();

  return (
    <div className="w-full bg-stone-50 min-h-screen flex flex-col font-sans" id="faculty_portal_viewport">
      {/* Dynamic Native looking portal top banner */}
      <div className="bg-[#002f5c] text-white p-5 pt-6 relative overflow-hidden select-none">
        {/* Abstract design blobs */}
        <div className="absolute right-0 top-0 w-24 h-24 bg-[#1e73be]/18 rounded-full blur-xl pointer-events-none" />
        
        {activeView === 'sessions' && (
          <div className="flex justify-between items-center relative z-10 animate-fadeIn">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-sky-200 tracking-wider">SCHOLARS PORTAL</span>
              <h2 className="text-lg font-black font-display text-white tracking-tight">{facultyName}</h2>
              <p className="text-[10.5px] text-sky-100/80">Faculty Advisor</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white bg-emerald-600 px-3 py-1 rounded-full animate-pulse shadow-sm flex items-center gap-1">
                Active Session
              </span>
              <button
                onClick={onSignOut}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white cursor-pointer"
                title="Sign Out"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {activeView === 'marking' && selectedSession && (
          <div className="flex items-center gap-3 relative z-10 animate-fadeIn">
            <button
              onClick={() => setActiveView('sessions')}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold text-sky-200 uppercase tracking-widest">{selectedSession.batchName}</span>
              <h3 className="text-base font-black font-display text-white leading-tight">{selectedSession.subject}</h3>
              <p className="text-[10.5px] text-sky-100/90">{selectedSession.time} • {selectedSession.room}</p>
            </div>
          </div>
        )}

        {activeView === 'success' && (
          <div className="text-center py-2 relative z-10 animate-fadeIn">
            <span className="text-2xl font-black font-display tracking-tight text-emerald-400">SUCCESS CARD</span>
          </div>
        )}
      </div>

      {/* Main View Scrollable content box */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        
        {/* VIEW 1: SESSIONS HUB */}
        {activeView === 'sessions' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Header statistics strip */}
            <div className="bg-white border border-outline-variant rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">PORTAL SUBMISSION RATIO</span>
                <span className="text-lg font-black font-display text-text-primary">
                  {markedSessions.length} of {activeSessions.length + markedSessions.length} sessions marked
                </span>
                
                {/* Progress bar */}
                <div className="w-48 bg-[#f1f3f5] h-2 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#107c41] rounded-full transition-all duration-300"
                    style={{ width: `${(markedSessions.length / ((activeSessions.length + markedSessions.length) || 1)) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-xl font-extrabold text-[#107c41]">
                {Math.round((markedSessions.length / ((activeSessions.length + markedSessions.length) || 1)) * 100)}%
              </span>
            </div>

            {/* List Tab selectors */}
            <div className="flex bg-stone-200/60 p-1 rounded-xl">
              <button
                onClick={() => setHistoryTab('scheduled')}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${historyTab === 'scheduled' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
              >
                Today's Schedules ({activeSessions.length})
              </button>
              <button
                onClick={() => setHistoryTab('history')}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${historyTab === 'history' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
              >
                Submission Archives ({markedSessions.length})
              </button>
            </div>

            {/* Scheduled session list */}
            {historyTab === 'scheduled' ? (
              <div className="flex flex-col gap-3">
                {activeSessions.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-outline-variant rounded-2xl bg-white">
                    <CheckCircle className="w-10 h-10 text-present-green mx-auto mb-2" />
                    <p className="text-sm font-bold text-text-primary">All Sessions Completed!</p>
                    <p className="text-xs text-[#555a64] mt-0.5">You have successfully submitted presence logs for overall designated batches today.</p>
                  </div>
                ) : (
                  activeSessions.map(session => {
                    const isCancelled = session.status === 'Cancelled';
                    const isUpcoming = session.status === 'Upcoming';
                    return (
                      <div
                        key={session.id}
                        className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col gap-3.5 transition-all outline-primary hover:border-primary border-outline-variant duration-150`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-extrabold text-[#107c41] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 self-start uppercase tracking-wider">
                              Batch: {session.batchTag}
                            </span>
                            <h4 className="text-sm font-bold text-text-primary mt-1">{session.subject}</h4>
                            <p className="text-[11px] text-[#555a64] flex items-center gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-secondary" />
                              {session.time} • {session.room}
                            </p>
                          </div>

                          {isCancelled ? (
                            <span className="text-[9px] font-bold bg-red-50 text-absent-red px-2 py-1 rounded border border-red-100 flex items-center gap-0.5">
                              <X className="w-3 h-3" /> CANCELLED
                            </span>
                          ) : isUpcoming ? (
                            <span className="text-[9px] font-bold bg-blue-50 text-sky-700 px-2 py-1 rounded border border-blue-100 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> UPCOMING
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 flex items-center gap-0.5">
                              <AlertCircle className="w-3 h-3 animate-pulse" /> PENDING
                            </span>
                          )}
                        </div>

                        {!isCancelled && (
                          <button
                            onClick={() => startMarkingAttendance(session)}
                            className="w-full text-center text-xs font-display font-medium py-2 bg-[#1e73be] hover:bg-primary text-white rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            Mark Attendance
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Submission list history tab */
              <div className="flex flex-col gap-3">
                {markedSessions.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-outline-variant rounded-2xl bg-white text-gray-400">
                    <History className="w-9 h-9 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Archives Empty</p>
                    <p className="text-[10px] mt-0.5">Marking records logged in the mobile portal will log here.</p>
                  </div>
                ) : (
                  markedSessions.map(session => (
                    <div key={session.id} className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex justify-between items-center">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[#8a909a] uppercase">{session.batchName}</span>
                        <h4 className="text-xs font-bold text-text-primary">{session.subject}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                          <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Present: {session.presentCount}
                          </span>
                          <span className="font-semibold text-red-800 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                            Absent: {session.absentCount}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[#107c41]">
                        <Check className="w-4 h-4" />
                        <span className="text-[10px] font-bold">SUBMITTED</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ROSTER LIST MARKING SHEET */}
        {activeView === 'marking' && selectedSession && (
          <div className="flex flex-col gap-4 animate-fadeIn pb-24">
            {/* Batch metrics summary */}
            <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#555a64]">ROSTER PARTICIPATION</span>
                <span className="text-sm font-black text-text-primary">{markingMetrics.presentCount} of {markingMetrics.total} present</span>
              </div>
              
              {/* Progress dynamic bar */}
              <div className="w-full bg-[#f1f3f5] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#107c41] rounded-full transition-all duration-300"
                  style={{ width: `${markingMetrics.percentage}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] font-bold mt-1 text-[#555a64]">
                <span>Present Ratio: {markingMetrics.percentage}%</span>
                <span>Absents: {markingMetrics.absentCount}</span>
              </div>
            </div>

            {/* Quick bulk controls */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-[#8a909a]">COHORT STUDENTS LIST</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleAll('Present')}
                  className="text-[10px] font-bold text-[#107c41] bg-emerald-50 px-2 py-1 rounded border border-emerald-200 cursor-pointer"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => handleToggleAll('Absent')}
                  className="text-[10px] font-bold text-absent-red bg-red-50 px-2 py-1 rounded border border-red-200 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Roster student card lists */}
            <div className="flex flex-col gap-2" id="attendance_roster_list_grid">
              {students.filter(s => s.batchId === selectedSession.batchId).map((student, idx) => {
                const mark = attendanceSheet[student.id] || 'Present';
                const isPresent = mark === 'Present';
                
                return (
                  <div
                    key={student.id}
                    className="bg-white border border-outline-variant rounded-xl p-3 flex justify-between items-center shadow-xs transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">{student.name.charAt(0)}</div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">{student.name}</h4>
                      </div>
                    </div>

                    {/* Sliding/Toggling toggle buttons representing Design specs */}
                    <div className="flex bg-stone-100 p-0.5 rounded-lg border border-outline-variant">
                      <button
                        onClick={() => handleToggleAttendance(student.id, 'Present')}
                        className={`text-[10px] font-bold py-1.5 px-3 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          isPresent
                            ? "bg-[#107c41] text-white shadow-xs"
                            : "text-[#555a64]"
                        }`}
                        type="button"
                      >
                        <Check className="w-3 h-3" /> P
                      </button>
                      
                      <button
                        onClick={() => handleToggleAttendance(student.id, 'Absent')}
                        className={`text-[10px] font-bold py-1.5 px-3 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          !isPresent
                            ? "bg-absent-red text-white shadow-xs"
                            : "text-[#555a64]"
                        }`}
                        type="button"
                      >
                        <X className="w-3 h-3" /> A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Floating Submit button area */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-outline-variant p-4 flex justify-between items-center z-10">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400">SUBMISSION SCOPE</span>
                <span className="text-xs font-bold text-[#107c41]">{markingMetrics.presentCount} P / {markingMetrics.absentCount} A</span>
              </div>
              <button
                onClick={handleSubmitAttendance}
                className="px-6 py-3 bg-[#107c41] hover:bg-[#0c5c30] text-white rounded-xl font-display font-bold text-xs flex items-center gap-2 shadow-md hover:scale-[1.01] transition-transform cursor-pointer"
                type="button"
              >
                Submit Absences To parents
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: SUCCESS CONFIRMATION MODAL */}
        {activeView === 'success' && successStats && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-6 animate-fadeIn bg-white rounded-2xl border border-outline-variant shadow-xs">
            {/* Pulsing Green Check Circle with background waves */}
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping scale-150 opacity-40" />
              <div className="w-20 h-20 bg-emerald-100 text-[#107c41] rounded-full flex items-center justify-center relative z-10 border-4 border-white shadow-md">
                <Check className="w-10 h-10 stroke-[3px]" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-black font-display text-text-primary">Attendance Logged Successfully</h3>
              <p className="text-xs text-[#555a64] max-w-xs mx-auto px-2">
                The student participation index of this batch was saved, and instant notifications have been filed.
              </p>
            </div>

            {/* Summary statistics */}
            <div className="w-full bg-[#fcfdfe] border border-[#dee2e6] rounded-2xl p-4 grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5 border-r">
                <span className="text-[9px] font-bold text-gray-400">TOTAL ROSTER</span>
                <span className="text-base font-black text-slate-800">{successStats.total} Students</span>
              </div>
              <div className="flex flex-col gap-0.5 border-r">
                <span className="text-[9px] font-bold text-[#107c41]">PRESENT COUNT</span>
                <span className="text-base font-black text-[#107c41]">{successStats.present} Logged</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-absent-red">ABSENT ALERTS</span>
                <span className="text-base font-black text-absent-red">{successStats.absent} Sent</span>
              </div>
            </div>

            {/* Informative alert banner */}
            <div className="w-full bg-emerald-50/55 border border-emerald-200/90 rounded-xl p-3 text-left flex gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald-950">Parent Broadcast Channels:</span>
                <span className="text-[9.5px] text-emerald-800 font-medium leading-relaxed mt-0.5">
                  Attendance logs have queued for immediate WhatsApp broadcast channels. Real-time delivery status can be tracked in the Admin Portal notification dashboards.
                </span>
              </div>
            </div>

            {/* Navigation back buttons */}
            <div className="w-full flex flex-col gap-2 mt-4">
              <button
                onClick={() => {
                  setSelectedSession(null);
                  setActiveView('sessions');
                }}
                className="w-full py-3 bg-[#002f5c] hover:bg-primary-container text-white text-xs font-display font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                type="button"
              >
                Back to Today's Sessions List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
