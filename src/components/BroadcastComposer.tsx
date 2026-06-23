import React, { useState, useEffect } from "react";
import { MessageSquare, Send, BookOpen, Smartphone, Users, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { Student, BroadcastTemplate, NotificationLog } from "../types";

interface BroadcastComposerProps {
  students: Student[];
  templates: BroadcastTemplate[];
  onSend: (newLogs: NotificationLog[]) => void;
}

export default function BroadcastComposer({ students, templates, onSend }: BroadcastComposerProps) {
  const [selectedBatch, setSelectedBatch] = useState<string>("All Batches");
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'at-risk' | 'custom'>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const channel = 'whatsapp';
  const [messageText, setMessageText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Simulation and UI flags
  const [isSending, setIsSending] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  const sendTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine unique batch names
  const batches = ["All Batches", ...Array.from(new Set(students.map(s => s.batch)))];

  // Pick a default preview student for live rendering
  useEffect(() => {
    if (students.length > 0) {
      const atRisk = students.find(s => s.attendancePercentage < 75);
      setPreviewStudent(atRisk || students[0]);
    }
  }, [students]);

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Handle template switching
  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      setMessageText(template.message);
    } else {
      setMessageText("");
    }
  };

  // Compile preview text substituting variables
  const getCompiledText = () => {
    if (!previewStudent) return messageText;
    
    const lastSubject = previewStudent.history.length > 0
      ? previewStudent.history[previewStudent.history.length - 1].subject
      : "[Subject]";

    let compiled = messageText;
    compiled = compiled.replace(/\{\{student_name\}\}/g, previewStudent.name);
    compiled = compiled.replace(/\{\{batch_name\}\}/g, previewStudent.batch);
    compiled = compiled.replace(/\{\{subject\}\}/g, lastSubject);
    compiled = compiled.replace(/\{\{attendance_rate\}\}/g, previewStudent.attendancePercentage.toString());
    compiled = compiled.replace(/\{\{present_count\}\}/g, previewStudent.stats.present.toString());
    compiled = compiled.replace(/\{\{total_count\}\}/g, previewStudent.stats.total.toString());
    compiled = compiled.replace(/\{\{percentage\}\}/g, previewStudent.attendancePercentage.toString());

    return compiled || "Select a template or type a message to preview it here...";
  };

  // Determine recipients based on filter selections
  const getRecipientsList = () => {
    let list = students;
    
    if (selectedBatch !== "All Batches") {
      list = list.filter(s => s.batch === selectedBatch);
    }

    if (recipientFilter === 'at-risk') {
      list = list.filter(s => s.attendancePercentage < 75);
    } else if (recipientFilter === 'custom') {
      if (selectedStudents.length > 0) {
        list = list.filter(s => selectedStudents.includes(s.id));
      } else {
        list = [];
      }
    }

    return list;
  };

  const toggleStudentSelection = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(sid => sid !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const handleSend = () => {
    const targets = getRecipientsList();
    if (targets.length === 0) return;

    setIsSending(true);
    
    // Create new logs
    sendTimerRef.current = setTimeout(() => {
      const newLogs: NotificationLog[] = targets.map((student, i) => {
        let textStr = messageText;
        textStr = textStr.replace(/\{\{student_name\}\}/g, student.name);
        textStr = textStr.replace(/\{\{batch_name\}\}/g, student.batch);
        textStr = textStr.replace(/\{\{subject\}\}/g, "Academic Class");
        textStr = textStr.replace(/\{\{attendance_rate\}\}/g, student.attendancePercentage.toString());
        textStr = textStr.replace(/\{\{present_count\}\}/g, student.stats.present.toString());
        textStr = textStr.replace(/\{\{total_count\}\}/g, student.stats.total.toString());
        textStr = textStr.replace(/\{\{percentage\}\}/g, student.attendancePercentage.toString());

        return {
          id: `broadcast_log_${Date.now()}_${i}`,
          recipient: `${student.parentName} (F/o ${student.name})`,
          channel: channel,
          status: "Delivered",
          message: textStr,
          timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        };
      });

      onSend(newLogs);
      setIsSending(false);
      setShowSuccessToast(true);
      
      // Auto-hide toast after 3 seconds
      toastTimerRef.current = setTimeout(() => setShowSuccessToast(false), 3500);
    }, 1200);
  };

  const filteredSearchList = students.filter(s => 
    s.name.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="broadcast_composer_container">
      {/* Parameters Panel */}
      <div className="lg:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold font-display text-text-primary flex items-center gap-2">
            <MessageSquare className="text-secondary w-5.5 h-5.5" />
            Manual Broadcast Campaign
          </h3>
          <p className="text-xs text-[#555a64]">
            Draft and instantly broadcast important notices, absences, and academic alerts to parents.
          </p>
        </div>

        {/* Channels selector cards */}
        <div className="grid grid-cols-1">
          <div className="border border-emerald-600 bg-emerald-50/40 text-emerald-950 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg flex items-center justify-center bg-emerald-600 text-white shadow-xs">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.1 1.45 4.6 1.455 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8-9.8 4.4-9.8 9.8c0 2 .5 3.8 1.5 5.4l-.9 3.4 3.6-.9z"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Active Delivery Channel: WhatsApp</span>
              <span className="text-xs text-[#555a64] mt-0.5">Automated instant WhatsApp notification alerts</span>
            </div>
          </div>
        </div>

        {/* Recipients Filter Selectors */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold text-text-secondary">RECIPIENTS AND COHORT</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#555a64]">Filter Batch</span>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full text-xs font-semibold bg-[#fafbfd] border border-outline-variant rounded-lg p-2.5 outline-primary cursor-pointer"
              >
                {batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#555a64]">Segment Criteria</span>
              <div className="flex bg-[#ebecef] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRecipientFilter('all')}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${recipientFilter === 'all' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
                >
                  All Cohort
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientFilter('at-risk')}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${recipientFilter === 'at-risk' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
                >
                  At Risk (&lt;75%)
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientFilter('custom')}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${recipientFilter === 'custom' ? "bg-white text-text-primary shadow-xs" : "text-[#555a64]"}`}
                >
                  Custom List
                </button>
              </div>
            </div>
          </div>

          {/* Custom students checklist */}
          {recipientFilter === 'custom' && (
            <div className="border border-outline-variant rounded-xl p-4 bg-[#fafbfd] flex flex-col gap-3 animate-fadeIn">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8a909a] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search individual students..."
                  className="w-full text-xs pl-9 pr-3 py-2 border border-outline-variant rounded-md outline-primary bg-white"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                />
              </div>
              <div className="max-h-36 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                {filteredSearchList.map(s => {
                  const isChecked = selectedStudents.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2.5 p-1.5 hover:bg-neutral-100 rounded-md cursor-pointer transition-colors text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStudentSelection(s.id)}
                        className="rounded accent-primary w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-text-primary">{s.name}</span>
                      <span className="ml-auto text-[10px] bg-secondary-fixed text-on-secondary-fixed-variant font-medium px-2 py-0.5 rounded-full">{s.batch}</span>
                    </label>
                  );
                })}
              </div>
              <div className="text-[10px] text-[#8a909a] font-medium flex items-center justify-between">
                <span>{selectedStudents.length} Students selected</span>
                <button onClick={() => setSelectedStudents([])} className="text-primary hover:underline">Clear selected</button>
              </div>
            </div>
          )}

          {/* Recipients matching preview note */}
          <div className="bg-[#ebecef]/40 rounded-xl p-3 px-4 flex items-center justify-between text-xs font-semibold text-text-secondary">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" />
              <span>Target Recipients count:</span>
            </div>
            <span className="text-sm bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full">{getRecipientsList().length} parent contacts</span>
          </div>
        </div>

        {/* Choose templates preset */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" /> Quick Loader Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplateSelect(t.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedTemplateId === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant bg-[#fafbfd] text-text-secondary hover:bg-neutral-50"
                }`}
                type="button"
              >
                {t.title}
              </button>
            ))}
            <button
              onClick={() => handleTemplateSelect("")}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-outline-variant bg-transparent text-[#979da6] hover:bg-neutral-50 cursor-pointer"
              type="button"
            >
              Clear Workspace
            </button>
          </div>
        </div>

        {/* Edit Message Content */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-text-secondary">EDIT MESSAGE STRUCTURE</label>
            <span className={`text-[10px] font-bold ${messageText.length > 250 ? "text-absent-red animate-pulse" : "text-[#7b818a]"}`}>
              {messageText.length} / 1000 characters
            </span>
          </div>
          <textarea
            className="w-full text-xs font-medium p-4 border border-outline-variant rounded-xl h-44 outline-primary focus:border-primary placeholder-stone-400 leading-relaxed bg-[#fafbfd]"
            placeholder="Write custom broadcast announcements here..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value.substring(0, 1000))}
          />
          <div className="p-3 bg-tertiary-fixed/40 border border-tertiary-fixed text-on-tertiary-fixed-variant rounded-xl text-[10px] font-medium leading-normal flex items-start gap-1.5 mt-1">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#5c3e04]">Available Data Placeholders:</p>
              <div className="flex flex-wrap gap-1.5 gap-y-1 mt-1.5">
                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#efd8b9]">{"{{student_name}}"}</span>
                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#efd8b9]">{"{{batch_name}}"}</span>
                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#efd8b9]">{"{{attendance_rate}}"}</span>
                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#efd8b9]">{"{{subject}}"}</span>
                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#efd8b9]">{"{{present_count}}"}</span>
                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-[#efd8b9]">{"{{total_count}}"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Send Broadcast Action */}
        <button
          onClick={handleSend}
          disabled={!messageText.trim() || getRecipientsList().length === 0 || isSending}
          className="w-full font-display font-bold py-3.5 bg-primary text-white hover:bg-primary-container rounded-xl disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          type="button"
        >
          {isSending ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Broadcasting Alert Messages...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Broadcast Notification Campaign Now
            </>
          )}
        </button>
      </div>

      {/* High Fidelity Phone Preview Frame */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <label className="text-xs font-bold text-text-secondary flex items-center gap-1 lg:pl-2">
          <Smartphone className="w-4 h-4 text-[#737882]" /> LIVE MOBILE PHONE SCREEN SIMULATOR
        </label>
        
        {/* Actual Phone Frame container */}
        <div className="relative mx-auto w-full max-w-[320px] aspect-[9/18.5] bg-stone-900 rounded-[40px] border-[10px] border-stone-800 shadow-2xl flex flex-col overflow-hidden ring-4 ring-neutral-200">
          {/* Phone Top Notch */}
          <div className="absolute top-0 inset-x-0 h-4 bg-stone-800 rounded-b-xl z-20 flex items-center justify-center">
            <div className="w-16 h-3 bg-black rounded-full" />
          </div>

          {/* Phone Screen Canvas */}
          <div className="w-full h-full flex flex-col text-white select-none bg-[#efeae2]">
            {/* Phone Screen Status Bar */}
            <div className="h-7 pt-4 px-6 flex justify-between items-center text-[10px] font-semibold text-black/60 z-10 select-none">
              <span className="text-slate-800">9:41 AM</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded-xs border-xs border-slate-800 bg-slate-800/80" />
              </div>
            </div>

            {/* WhatsApp Layout Mock */}
            <div className="flex-1 flex flex-col text-slate-800 relative">
              {/* Chat Header */}
              <div className="bg-[#075e54] text-white p-2.5 px-3 flex items-center gap-2.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-700/80 flex items-center justify-center font-display font-extrabold text-xs text-emerald-100 border-xs border-emerald-500">
                  ISH
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold flex items-center gap-1">
                    Scholar's Hub Official
                    <span className="text-[9px] bg-sky-400 text-slate-950 px-1 py-0.2 rounded-full font-bold">✓</span>
                  </span>
                  <span className="text-[9px] text-[#b2dfdb]">In-App Broadcast Support Channel</span>
                </div>
              </div>

              {/* Chat Background Graphic overlay */}
              <div className="flex-1 p-3 flex flex-col justify-start relative select-none">
                {/* Watermark logo watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5 select-none pointer-events-none">
                  <Smartphone className="w-32 h-32" />
                </div>

                {/* System/Date stamp */}
                <div className="mx-auto bg-white/70 shadow-xs text-[9px] text-slate-500 px-3 py-1 rounded-md mb-4 font-semibold select-none">
                  TODAY
                </div>

                {/* WhatsApp speech bubble */}
                <div className="bg-[#e5f8cf] border border-[#d6eba6] rounded-xl rounded-tr-none p-3 ml-4 max-w-[240px] text-[11px] leading-relaxed relative shadow-xs animate-fadeIn text-slate-900">
                  <p className="font-semibold text-emerald-800 text-[10px] mb-1">Infinity Scholar's Hub</p>
                  <div className="whitespace-pre-line text-[#101419] font-medium font-sans">
                    {getCompiledText()}
                  </div>
                  
                  {/* Timestamp inside chat card */}
                  <div className="text-[8px] text-slate-400 float-right mt-1.5 font-bold">
                    9:41 AM <span className="text-emerald-600">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Typing footer bar */}
              <div className="bg-[#f0f0f0] p-2 flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] text-slate-400 flex items-center">
                  Message broadcast enabled...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick select simulator preview student */}
        <div className="bg-white border border-outline-variant p-4 rounded-xl flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-[#555a64]">Toggle Student Preview Variables:</span>
          <div className="flex flex-col gap-1.5">
            {students.filter(s => s.attendancePercentage < 75).slice(0, 3).map(s => (
              <button
                key={s.id}
                onClick={() => setPreviewStudent(s)}
                className={`text-left text-xs p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                  previewStudent?.id === s.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-outline-variant bg-transparent hover:bg-neutral-50 text-text-secondary"
                }`}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center uppercase">
                    {s.name.charAt(0)}
                  </div>
                  <span className="font-semibold">{s.name}</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  {s.attendancePercentage}% At Risk
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Action Notifications */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 p-4 bg-zinc-900 border border-zinc-800 text-white rounded-xl shadow-xl flex items-center gap-3 z-50 animate-slideUp max-w-sm">
          <CheckCircle2 className="w-6 h-6 text-present-green shrink-0" />
          <div>
            <p className="text-xs font-bold font-display">Broadcast Campaign Dispatched!</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Custom absence cards have been processed and stored in notification log archives.</p>
          </div>
        </div>
      )}
    </div>
  );
}
