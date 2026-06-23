import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Settings, ShieldAlert, CheckCircle } from "lucide-react";
import { HolidayEvent, BatchSchedule } from "../types";

interface CalendarViewProps {
  holidays: HolidayEvent[];
  onAddHoliday: (newEvent: HolidayEvent) => void;
  onDeleteHoliday: (id: string) => void;
  batchSchedules: BatchSchedule[];
  onUpdateBatchSchedule: (updated: BatchSchedule[]) => void;
}

export default function CalendarView({ holidays, onAddHoliday, onDeleteHoliday, batchSchedules, onUpdateBatchSchedule }: CalendarViewProps) {
  const [activeTab, setActiveTab] = useState<'month' | 'schedule'>('month');
  const [inspectorDate, setInspectorDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Custom Exception Form inputs
  const [evtName, setEvtName] = useState("");
  const [evtDate, setEvtDate] = useState(new Date().toISOString().split('T')[0]);
  const [evtType, setEvtType] = useState<'holiday' | 'makeup' | 'meeting'>('holiday');
  const [evtNotes, setEvtNotes] = useState("");
  
  // Track calculation helpers
  const getDayOfWeekName = (dateStr: string) => {
    // Adding a timezone boundary offset to parse cleanly as local/UTC date
    const parts = dateStr.split("-");
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[d.getDay()];
  };

  const getTrackStatusForDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayIndex = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    
    // Check if this date is in our holidays list
    const dayHoliday = holidays.find(h => h.date === dateStr);
    
    if (dayHoliday) {
      if (dayHoliday.type === 'holiday') {
        return {
          trackName: "Holiday Closure",
          activeBatches: [] as BatchSchedule[],
          isClosed: true,
          summary: `School closed due to holiday: ${dayHoliday.name}`,
          notes: dayHoliday.notes || ""
        };
      }
      if (dayHoliday.type === 'makeup') {
        return {
          trackName: "Unified Makeup Track",
          activeBatches: batchSchedules,
          isClosed: false,
          summary: `All center batches consolidated for makeup learning - ${dayHoliday.name}`,
          notes: dayHoliday.notes || ""
        };
      }
    }

    if (dayIndex === 0) {
      return {
        trackName: "Sunday Recess",
        activeBatches: [] as BatchSchedule[],
        isClosed: true,
        summary: "Sunday recess. No normal classes running today.",
        notes: "Optional test series evaluation or staff training active."
      };
    }

    const activeBatchesOnThisDay = batchSchedules.filter(b => b.activeDays.includes(dayIndex));
    const activeNames = activeBatchesOnThisDay.map(b => `${b.batchName} (${b.batchTag})`).join(", ");

    return {
      trackName: `${activeBatchesOnThisDay.length} Active Batches`,
      activeBatches: activeBatchesOnThisDay,
      isClosed: false,
      summary: activeBatchesOnThisDay.length > 0
        ? `Configured to run sessions for: ${activeNames}`
        : "No active batches are configured to run on this day of the week.",
      notes: "Fetched dynamically from the Live Batch Scheduling configuration table."
    };
  };

  const dayOfWeekName = getDayOfWeekName(inspectorDate);
  const trackInfo = getTrackStatusForDate(inspectorDate);
  
  // Statuses
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Policy Flags
  const [policyNotifyBefore, setPolicyNotifyBefore] = useState(true);
  const [policyAutoReminders, setPolicyAutoReminders] = useState(true);

  const monthDays = Array.from({ length: 30 }, (_, i) => i + 1); // 30 Days in June 2026
  const startDayOffset = 0; // June 1, 2026 is a Monday — grid starts at MON, so no offset needed

  // Retrieve event matches for specific day of June
  const getEventsForDay = (day: number) => {
    const formattedDate = `2026-06-${day.toString().padStart(2, '0')}`;
    return holidays.filter(h => h.date === formattedDate);
  };

  const handleCreateException = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtName.trim()) return;

    const newEvt: HolidayEvent = {
      id: `hol_user_${Date.now()}`,
      name: evtName,
      date: evtDate,
      type: evtType,
      notes: evtNotes
    };

    onAddHoliday(newEvt);
    setEvtName("");
    setEvtNotes("");
    
    setToastMessage(`Created exception: "${newEvt.name}" successfully!`);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="academic_calendar_widget">
      {/* Calendar Grid & Main Board */}
      <div className="lg:col-span-8 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-outline-variant pb-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold font-display text-text-primary flex items-center gap-2">
              <CalendarIcon className="text-primary w-5 h-5" />
              Academic Exceptions Calendar
            </h3>
            <p className="text-xs text-[#555a64]">
              Manage holidays, coordinate custom make-up batches, and schedule staff audits.
            </p>
          </div>
          
          <div className="flex bg-[#ebecef] p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('month')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer ${activeTab === 'month' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
            >
              June 2026 View
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer ${activeTab === 'schedule' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
            >
              Batch Weekly Rules
            </button>
          </div>
        </div>

        {activeTab === 'month' ? (
          /* Monthly Calendar Grid Layout */
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Weekdays standard header */}
            <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-400">
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
              <span>SUN</span>
            </div>

            {/* Grid Map Cells */}
            <div className="grid grid-cols-7 gap-2 bg-[#fbfcfd] p-2 border border-outline-variant rounded-xl min-h-[360px]" id="calendar_grid">
              {/* Optional start spacing */}
              {Array.from({ length: startDayOffset }).map((_, idx) => (
                <div key={`offset-${idx}`} className="bg-transparent" />
              ))}

              {/* Real Days list */}
              {monthDays.map(day => {
                const dayEvents = getEventsForDay(day);
                const currentCellDate = `2026-06-${day.toString().padStart(2, '0')}`;
                const isSelected = inspectorDate === currentCellDate;
                return (
                  <div
                    key={`day-${day}`}
                    onClick={() => setInspectorDate(currentCellDate)}
                    className={`border rounded-lg p-2 flex flex-col gap-1 min-h-[72px] transition-all cursor-pointer relative group ${
                      isSelected
                        ? "border-[#1e73be]"
                        : "border-[#ebeef0] bg-white hover:bg-[#1e73be]/5"
                    }`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? "text-[#1e73be]" : "text-text-secondary"}`}>{day}</span>
                    
                    {/* Events bubbles */}
                    <div className="flex flex-col gap-1 max-h-[50px] overflow-y-auto custom-scrollbar">
                      {dayEvents.map(evt => {
                        const styleClass = 
                          evt.type === 'holiday' 
                            ? "bg-red-50 text-absent-red border-red-200" 
                            : evt.type === 'makeup' 
                              ? "bg-emerald-50 text-present-green border-emerald-200" 
                              : "bg-amber-50 text-amber-800 border-amber-200";
                        return (
                          <div
                            key={evt.id}
                            title={evt.notes || evt.name}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border truncate leading-normal ${styleClass}`}
                          >
                            {evt.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Detailed Lists & Config Table View */
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Part 1: Interactive Batch Schedule Config Table */}
            <div className="bg-[#fafbfd] border border-outline-variant rounded-xl p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-b border-slate-200 pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-[#1e73be] flex items-center gap-1.5 font-display">
                  <Settings className="w-4 h-4 shrink-0" />
                  Live Cohort Schedule Controller
                </span>
                <p className="text-[10px] text-zinc-500">
                  Toggle active tutoring days for each batch. Changes are compiled instantly into the calendar track rules.
                </p>
              </div>

              <div className="flex flex-col gap-3.5">
                {batchSchedules.map(b => (
                  <div key={b.batchId} className="bg-white border border-slate-100 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-xs text-text-primary">{b.batchName}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">Batch Code: {b.batchId} ({b.batchTag})</span>
                    </div>

                    {/* Checkboxes index: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6].map(dayIndex => {
                        const daysShort = ["", "M", "T", "W", "Th", "F", "Sa"];
                        const dayLabel = daysShort[dayIndex];
                        const isChecked = b.activeDays.includes(dayIndex);
                        
                        const handleToggleDay = () => {
                          const nextDays = isChecked 
                            ? b.activeDays.filter(d => d !== dayIndex)
                            : [...b.activeDays, dayIndex].sort();
                          
                          // Map and compile
                          const updatedSchedules = batchSchedules.map(item => {
                            if (item.batchId === b.batchId) {
                              return { ...item, activeDays: nextDays };
                            }
                            return item;
                          });
                          onUpdateBatchSchedule(updatedSchedules);
                        };

                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={handleToggleDay}
                            className={`w-7 h-7 rounded-md text-[10px] font-black cursor-pointer border flex items-center justify-center transition-all ${
                              isChecked
                                ? "bg-[#1e73be] text-white border-[#1e73be] shadow-xs"
                                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                            }`}
                            title={`Toggle standard ${daysShort[dayIndex]}`}
                          >
                            {dayLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Part 2: Exception Directory */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-text-secondary">Calendar Exception Records ({holidays.length})</span>
              {holidays.length === 0 ? (
                <div className="text-center p-6 text-zinc-400 text-xs border border-dashed rounded-xl">
                  No custom active holidays configured. Add one on the right.
                </div>
              ) : (
                holidays.map(evt => {
                  const theme = 
                    evt.type === 'holiday' 
                      ? { bg: "bg-red-50 text-absent-red border-red-100", label: "Holiday" } 
                      : evt.type === 'makeup' 
                        ? { bg: "bg-emerald-50 text-present-green border-emerald-100", label: "Makeup Class" } 
                        : { bg: "bg-amber-50 text-[#7b4f00] border-amber-100", label: "Staff Event" };
                  
                  return (
                    <div key={evt.id} className="border border-outline-variant rounded-xl p-4 flex justify-between items-center bg-[#fafbfd]">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex items-center justify-center font-bold text-xs ${theme.bg}`}>
                          {theme.label}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-sm font-semibold text-text-primary">{evt.name}</h4>
                          <p className="text-xs text-[#555a64] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-secondary" />
                            Scheduled Date: {evt.date} {evt.notes ? `• ${evt.notes}` : ""}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteHoliday(evt.id)}
                        className="p-2 text-[#8a909a] hover:text-absent-red rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                        title="Delete exception record"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Exception Creation & Toggle Policy Sidebar */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Odd/Even Day Rotation Rule Inspector Card */}
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4 animate-fadeIn">
          <div className="flex flex-col gap-1 border-b border-outline-variant pb-3">
            <h4 className="text-sm font-bold font-display text-text-primary flex items-center gap-1.5 text-[#1e73be]">
              <Clock className="w-4 h-4 text-[#1e73be]" />
              Schedule Rotation Track Inspector
            </h4>
            <p className="text-[10px] text-zinc-500">
              Interactive sandbox inspecting Classes 6–10 odd/even scheduler.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-text-secondary">TARGET DATE</span>
              <input
                type="date"
                value={inspectorDate}
                onChange={(e) => setInspectorDate(e.target.value)}
                className="text-xs p-1 px-2 border border-outline-variant rounded bg-white outline-none font-semibold text-text-primary"
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-400">DAY OF WEEK</span>
              <span className="text-xs font-black text-text-primary font-display">{dayOfWeekName}</span>
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 pt-2">
              <span className="text-[11.5px] font-bold text-zinc-500">ROTATION TRACK</span>
              <span className={`text-[10px] font-black uppercase tracking-tight py-1 px-2.5 rounded-full ${
                trackInfo.isClosed
                  ? "bg-red-50 text-red-700 border border-red-100"
                  : "bg-[#1e73be]/10 text-[#1e73be] border border-[#1e73be]/20"
              }`}>
                {trackInfo.trackName}
              </span>
            </div>
          </div>

          {/* Active / Inactive Cohort Breakdown */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">COHORT STATUSES UNDER RULE</span>
            
            <div className="flex flex-col gap-1.5 text-xs max-h-[160px] overflow-y-auto custom-scrollbar">
              {batchSchedules.map(b => {
                const parts = inspectorDate.split("-");
                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const currentDayIndex = d.getDay();
                
                // If it is closed due to holiday, all are closed
                const isActive = !trackInfo.isClosed && b.activeDays.includes(currentDayIndex);
                
                return (
                  <div 
                    key={b.batchId}
                    className={`flex justify-between items-center p-2 rounded-lg border ${
                      isActive
                        ? "bg-emerald-50/50 border-emerald-100"
                        : "bg-zinc-100/55 border-zinc-200 opacity-65"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-bold ${isActive ? "text-emerald-950 block truncate max-w-[150px]" : "text-zinc-500 block truncate max-w-[150px]"}`}>
                        {b.batchName}
                      </span>
                      <span className="text-[9.5px] text-zinc-500 flex items-center gap-1 font-mono">
                        {b.activeDays.map(dayNum => {
                          const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          return daysShort[dayNum];
                        }).join(",") || "None"}
                      </span>
                    </div>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded leading-none ${
                      trackInfo.isClosed
                        ? "bg-red-100 text-red-800"
                        : isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-200 text-zinc-600"
                    }`}>
                      {trackInfo.isClosed ? "HOLIDAY" : isActive ? "ACTIVE" : "REST"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#1e73be]/5 text-[#1e73be] border border-[#1e73be]/10 p-2.5 rounded-xl flex items-start gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-[#1e73be] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5 text-[10px]">
              <span className="font-bold uppercase tracking-wider text-[#1e73be]">RESOLVED POLICY SUMMARY</span>
              <p className="text-zinc-600 leading-normal">{trackInfo.summary}</p>
              {trackInfo.notes && <p className="text-[#1e73be] font-semibold mt-0.5 italic">“{trackInfo.notes}”</p>}
            </div>
          </div>
        </div>

        {/* Exception Composer form */}
        <form onSubmit={handleCreateException} className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h4 className="text-sm font-bold font-display text-text-primary">Schedule New Exception</h4>
            <p className="text-[10px] text-[#555a64]">Add holidays or designate makeup cohorts instantly.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-secondary">EXCEPTION TYPE</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEvtType('holiday')}
                className={`text-xs font-semibold py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  evtType === 'holiday' ? "border-red-600 bg-red-50/50 text-red-950 font-bold" : "border-outline-variant text-[#555a64]"
                }`}
              >
                Holiday
              </button>
              <button
                type="button"
                onClick={() => setEvtType('makeup')}
                className={`text-xs font-semibold py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  evtType === 'makeup' ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold" : "border-outline-variant text-[#555a64]"
                }`}
              >
                Makeup
              </button>
              <button
                type="button"
                onClick={() => setEvtType('meeting')}
                className={`text-xs font-semibold py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  evtType === 'meeting' ? "border-amber-600 bg-amber-50/50 text-amber-950 font-bold" : "border-outline-variant text-[#555a64]"
                }`}
              >
                Staff Aud.
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-text-secondary">EVENT DETAILS NAME</label>
            <input
              type="text"
              required
              className="w-full text-xs p-2.5 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]"
              placeholder="e.g. Eid Break, Dussehra Break..."
              value={evtName}
              onChange={(e) => setEvtName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-text-secondary">TARGET DATE</label>
            <input
              type="date"
              required
              className="w-full text-xs p-2.5 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]"
              value={evtDate}
              onChange={(e) => setEvtDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-text-secondary">INTERNAL REMARKS (OPTIONAL)</label>
            <textarea
              className="w-full text-xs p-2.5 border border-outline-variant rounded-lg outline-primary h-14 bg-[#fafbfd]"
              placeholder="e.g. Affects all morning science labs..."
              value={evtNotes}
              onChange={(e) => setEvtNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full text-xs font-display font-bold py-3 bg-[#1e73be] hover:bg-primary-container text-white rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Exception Event
          </button>
        </form>

        {/* Policy Toggles */}
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-outline-variant pb-2.5">
            <Settings className="w-4 h-4 text-secondary" />
            <h4 className="text-xs font-bold font-display text-text-primary">Calendar Policy Alerts</h4>
          </div>
          
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                className="mt-0.5 rounded accent-primary w-4 h-4"
                checked={policyNotifyBefore}
                onChange={() => setPolicyNotifyBefore(!policyNotifyBefore)}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-text-primary">Send Advance Broadcast</span>
                <span className="text-[9.5px] text-[#555a64] mt-0.5">Broadcasts WhatsApp alerts to parents 24 hours prior to closures.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                className="mt-0.5 rounded accent-primary w-4 h-4"
                checked={policyAutoReminders}
                onChange={() => setPolicyAutoReminders(!policyAutoReminders)}
              />
              <div className="flex flex-col">
                <span className="font-semibold text-text-primary">Automated Makeup Prompts</span>
                <span className="text-[9.5px] text-[#555a64] mt-0.5">Triggers rescheduling recommendations to matching teachers.</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Floating alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 p-3 bg-zinc-900 border border-zinc-800 text-white rounded-lg shadow-xl text-xs font-semibold z-50 flex items-center gap-2.5 animate-slideUp">
          <CheckCircle className="w-4 h-4 text-present-green shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
