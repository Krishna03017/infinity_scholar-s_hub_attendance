import React, { useState } from "react";
import {
  LayoutDashboard, GraduationCap, Users, UserCheck, MessageSquare,
  CalendarDays, BarChart3, Settings as SettingsIcon, AlertOctagon,
  Search, FileCheck,
  ChevronRight, RefreshCw, BellRing, Smartphone, AlertTriangle, Plus, X,
  Clock, Database, Edit3, Check, BookOpen
} from "lucide-react";
import { Student, Faculty, Session, NotificationLog, HolidayEvent, BroadcastTemplate, SettingsConfig } from "../types";
import CSVImporter from "../components/CSVImporter";
import BroadcastComposer from "../components/BroadcastComposer";
import Reports from "../components/Reports";
import CalendarView from "../components/CalendarView";


const schemaTablesData: Record<string, { desc: string; columns: { name: string; type: string; key: string; desc: string }[]; ddl: string }> = {
  students: {
    desc: "Main student directory table holding academic registration, enrollment profiles, and parent tracking phone metrics.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Unique identifier with prefix 'stu_'" },
      { name: "name", type: "TEXT", key: "Not Null", desc: "Legal full name of registered student" },
      { name: "email", type: "TEXT", key: "", desc: "Parent/guardian email address for notifications" },
      { name: "parent_name", type: "TEXT", key: "", desc: "Name of father/mother for WhatsApp targeting" },
      { name: "parent_phone", type: "TEXT", key: "", desc: "E.164 phone string starting with country code" },
      { name: "batch_id", type: "TEXT", key: "FK", desc: "References active batch schedules table" },
      { name: "target_threshold", type: "INTEGER", key: "Default 75", desc: "The safety attendance ceiling multiplier" },
      { name: "status", type: "TEXT", key: "Active/Suspended", desc: "Controls login lock and automated notifications" }
    ],
    ddl: `CREATE TABLE public.students (
    id TEXT PRIMARY KEY DEFAULT 'stu_' || gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    parent_name TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    batch_id TEXT REFERENCES public.batch_schedules(batch_id) ON DELETE SET NULL,
    target_threshold INTEGER DEFAULT 75,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  faculty: {
    desc: "Staff directory storing teacher names, contact numbers, and subject authorisations. Managed entirely by the admin.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Unique identifier with prefix 'fac_'" },
      { name: "name", type: "TEXT", key: "Not Null", desc: "Full name of the faculty member" },
      { name: "title", type: "TEXT", key: "", desc: "Academic designation, e.g. Senior HOD Physics" },
      { name: "phone", type: "TEXT", key: "", desc: "Contact phone number for admin reference" },
      { name: "subjects", type: "TEXT[]", key: "Array", desc: "Subjects they are authorised to mark attendance for" },
      { name: "status", type: "TEXT", key: "Active/On Leave", desc: "Restricts daily roster generation assignments" }
    ],
    ddl: `CREATE TABLE public.faculty (
    id TEXT PRIMARY KEY DEFAULT 'fac_' || gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    subjects TEXT[] NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  sessions: {
    desc: "Calculated sessions store scheduling actual class occurrences, assigned faculty, and marking metrics.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Unique identifier mapped as 'sess_'" },
      { name: "batch_id", type: "TEXT", key: "FK", desc: "References batch schedules" },
      { name: "subject", type: "TEXT", key: "", desc: "Tutoring content name (e.g. Zoology, Chemistry)" },
      { name: "session_time", type: "TEXT", key: "", desc: "Hour window (e.g. 10:15 AM)" },
      { name: "room_no", type: "TEXT", key: "", desc: "Physical space reference" },
      { name: "status", type: "TEXT", key: "Upcoming/Marked/Pending", desc: "Roster compilation state" },
      { name: "assigned_faculty_id", type: "TEXT", key: "FK", desc: "Verified staff member marking actual sheet" },
      { name: "present_count", type: "INTEGER", key: "Default 0", desc: "Live roll aggregate marked present" },
      { name: "absent_count", type: "INTEGER", key: "Default 0", desc: "Live roll aggregate marked absent" },
      { name: "scheduled_date", type: "DATE", key: "", desc: "Physical day of occurrence" }
    ],
    ddl: `CREATE TABLE public.sessions (
    id TEXT PRIMARY KEY DEFAULT 'sess_' || gen_random_uuid(),
    batch_id TEXT REFERENCES public.batch_schedules(batch_id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    session_time TEXT NOT NULL,
    room_no TEXT NOT NULL,
    status TEXT DEFAULT 'Upcoming' CHECK (status IN ('Marked', 'Pending', 'Upcoming', 'Cancelled', 'Makeup')),
    assigned_faculty_id TEXT REFERENCES public.faculty(id) ON DELETE SET NULL,
    marked_by TEXT,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    scheduled_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  student_attendance_records: {
    desc: "Granular historical marks connecting student biometric/classroom indices to session markings.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Unique record key prefixed with 'rec_'" },
      { name: "student_id", type: "TEXT", key: "FK", desc: "The evaluated student profile" },
      { name: "session_id", type: "TEXT", key: "FK", desc: "The evaluated session card" },
      { name: "status", type: "TEXT", key: "Check constraint", desc: "Either 'Present', 'Absent', or 'Excused'" },
      { name: "marked_by", type: "TEXT", key: "", desc: "Staff login identifier verifying presence" },
      { name: "marked_at", type: "TIMESTAMPTZ", key: "Default NOW()", desc: "Real clock stamp of marking moment" }
    ],
    ddl: `CREATE TABLE public.student_attendance_records (
    id TEXT PRIMARY KEY DEFAULT 'rec_' || gen_random_uuid(),
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Excused')),
    marked_by TEXT NOT NULL,
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, session_id)
);`
  },
  batch_schedules: {
    desc: "Configuration table determining week day schedules. Critical: read by live cron generator dynamically.",
    columns: [
      { name: "batch_id", type: "TEXT", key: "PK", desc: "Text code index (e.g. batch_11_jee)" },
      { name: "batch_name", type: "TEXT", key: "", desc: "Visual user label" },
      { name: "batch_tag", type: "TEXT", key: "", desc: "Classroom subgroup, e.g. Class 11-A" },
      { name: "active_days", type: "INTEGER[]", key: "Array", desc: "Integer list, where 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat" }
    ],
    ddl: `CREATE TABLE public.batch_schedules (
    batch_id TEXT PRIMARY KEY,
    batch_name TEXT NOT NULL,
    batch_tag TEXT NOT NULL,
    active_days INTEGER[] NOT NULL DEFAULT '{1,3,5}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  holidays: {
    desc: "Exemptions ledger overriding automated timeline compilation with holidays or specific makeup structures.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Database key reference" },
      { name: "exception_date", type: "DATE", key: "Unique", desc: "The date of exception" },
      { name: "event_name", type: "TEXT", key: "", desc: "Descriptive holiday reason" },
      { name: "type", type: "TEXT", key: "Check constraint", desc: "Either 'holiday', 'makeup' or 'meeting'" },
      { name: "notes", type: "TEXT", key: "Optional", desc: "Additional administrative guidelines" }
    ],
    ddl: `CREATE TABLE public.holidays (
    id TEXT PRIMARY KEY DEFAULT 'hol_' || gen_random_uuid(),
    exception_date DATE UNIQUE NOT NULL,
    event_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('holiday', 'makeup', 'meeting')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  broadcast_templates: {
    desc: "Approved Meta templates mapping the WhatsApp template schema structure for emergency contact alerts.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Approved UUID sequence" },
      { name: "title", type: "TEXT", key: "", desc: "Template system name label" },
      { name: "message", type: "TEXT", key: "", desc: "Body template holding placeholder tags" }
    ],
    ddl: `CREATE TABLE public.broadcast_templates (
    id TEXT PRIMARY KEY DEFAULT 'temp_' || gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  notification_logs: {
    desc: "Audit trailing logs documenting WhatsApp trigger delivery confirmations.",
    columns: [
      { name: "id", type: "TEXT", key: "PK", desc: "Log record key" },
      { name: "student_id", type: "TEXT", key: "FK", desc: "The targeted user account" },
      { name: "parent_phone", type: "TEXT", key: "", desc: "Destination mobile node address" },
      { name: "channel", type: "TEXT", key: "Check constraint", desc: "Only 'WhatsApp'" },
      { name: "status", type: "TEXT", key: "Check constraint", desc: "Confirmation state ('Delivered', 'Sent', 'Failed')" },
      { name: "message", type: "TEXT", key: "", desc: "Dump of specific text sent" }
    ],
    ddl: `CREATE TABLE public.notification_logs (
    id TEXT PRIMARY KEY DEFAULT 'log_' || gen_random_uuid(),
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    parent_phone TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('WhatsApp')),
    status TEXT NOT NULL CHECK (status IN ('Delivered', 'Sent', 'Failed')),
    message TEXT NOT NULL,
    dispatch_timestamp TIMESTAMPTZ DEFAULT NOW()
);`
  }
};

interface AdminPortalProps {
  students: Student[];
  faculty: Faculty[];
  sessions: Session[];
  notificationLogs: NotificationLog[];
  holidays: HolidayEvent[];
  templates: BroadcastTemplate[];
  settings: SettingsConfig;
  onUpdateSettings: (s: SettingsConfig) => void;
  
  onAddStudent: (s: Student) => void;
  onImportStudents: (s: Student[]) => void;
  onAddHoliday: (h: HolidayEvent) => void;
  onDeleteHoliday: (id: string) => void;
  onSendBroadcast: (logs: NotificationLog[]) => void;
  onUpdateStudents: (s: Student[]) => void;
  onUpdateSessions: (s: Session[]) => void;
  onAddFaculty: (f: Faculty) => void;
  onUpdateFaculty: (facultyId: string, updates: Partial<Faculty>) => void;
  onDeleteFaculty: (facultyId: string) => void;
  onSignOut: () => void;
  adminName: string;
}

export default function AdminPortal({
  students, faculty, sessions, notificationLogs, holidays, templates, settings,
  onUpdateSettings,
  onAddStudent, onImportStudents, onAddHoliday, onDeleteHoliday, onSendBroadcast,
  onUpdateStudents, onUpdateSessions, onAddFaculty, onUpdateFaculty, onDeleteFaculty, onSignOut, adminName
}: AdminPortalProps) {
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'batches' | 'students' | 'faculty' | 'notifications' | 'reports' | 'calendar' | 'composer' | 'settings'>('dashboard');
  
  // Dashboard states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchemaTable, setSelectedSchemaTable] = useState<string>("students");
  const [databaseSubTab, setDatabaseSubTab] = useState<'schema' | 'rls' | 'cron' | 'seed'>('schema');

  // Batches States
  const [selectedBatchId, setSelectedBatchId] = useState<string>((settings.batchSchedules || [])[0]?.batchId || "unassigned");
  const [batchCheckboxes, setBatchCheckboxes] = useState<Record<string, boolean>>({});
  const [showBatchActionPopup, setShowBatchActionPopup] = useState(false);
  const [showAddBatchForm, setShowAddBatchForm] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchTag, setNewBatchTag] = useState("");
  const [newBatchActiveDays, setNewBatchActiveDays] = useState<number[]>([1, 3, 5]);

  // Student Detail tab States
  const [focusedStudentId, setFocusedStudentId] = useState<string>(students[0]?.id || "");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Faculty subject editing state
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editSubjects, setEditSubjects] = useState<string[]>([]);
  const [newSubjectInput, setNewSubjectInput] = useState("");

  // Add Faculty form state
  const [showAddFacultyForm, setShowAddFacultyForm] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState("");
  const [newFacultyPhone, setNewFacultyPhone] = useState("");
  const [newFacultySubjects, setNewFacultySubjects] = useState<string[]>([]);
  const [newFacultySubjectInput, setNewFacultySubjectInput] = useState("");

  const handleAddFacultySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacultyName.trim()) return;
    const newF: Faculty = {
      id: `fac_${Date.now()}`,
      name: newFacultyName.trim(),
      title: "",
      phone: newFacultyPhone.trim(),
      subjects: newFacultySubjects,
      submissionRate: 100,
      status: "Active"
    };
    onAddFaculty(newF);
    setNewFacultyName("");
    setNewFacultyPhone("");
    setNewFacultySubjects([]);
    setNewFacultySubjectInput("");
    setShowAddFacultyForm(false);
  };

  // Common subjects for quick-add
  const COMMON_SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics", "English", "Zoology", "Botany", "Social Science", "Hindi", "Computer Science"];

  // Per-student batch reassignment state (maps studentId -> selected batchId)
  const [studentBatchOverrides, setStudentBatchOverrides] = useState<Record<string, string>>({});

  // Notification resend simulation trigger
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);

  // Quick student register Form
  const [quickRegName, setQuickRegName] = useState("");
  const [quickRegBatch, setQuickRegBatch] = useState((settings.batchSchedules || [])[0]?.batchId || "unassigned");
  const [quickRegPhone, setQuickRegPhone] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Quick Add Session Form
  const [showAddSessionForm, setShowAddSessionForm] = useState(false);
  const [newSessionBatchId, setNewSessionBatchId] = useState("unassigned");
  const [newSessionSubject, setNewSessionSubject] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("");
  const [newSessionRoom, setNewSessionRoom] = useState("");
  const [newSessionFaculty, setNewSessionFaculty] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);



  // Helper values
  const batchSchedules = settings.batchSchedules || [];
  const batchLookup = Object.fromEntries(batchSchedules.map(b => [b.batchId, b]));
  const getFilteredStudentsForBatch = (batchId: string) => {
    if (batchId === "unassigned") {
      return students.filter(s => !s.batchId || s.batchId === "unassigned" || s.batch === "Unassigned");
    }
    return students.filter(s => s.batchId === batchId);
  };
  const totalStudents = students.length;
  const averageAttendanceValue = (students.reduce((acc, s) => acc + s.attendancePercentage, 0) / (totalStudents || 1)).toFixed(1);
  const totalSessionsCount = sessions.length;
  const markedSessionsCount = sessions.filter(s => s.status === 'Marked').length;
  const unmarkedSessionsCount = totalSessionsCount - markedSessionsCount;

  // Selected batch info for the Batches Manager
  const selectedBatchInfo = batchLookup[selectedBatchId];
  const selectedBatchDaysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const selectedBatchScheduleLabel = selectedBatchInfo
    ? selectedBatchInfo.activeDays.map(d => selectedBatchDaysShort[d]).join(', ') + ' classes'
    : 'N/A';
  const selectedBatchLeadFaculty = faculty.find(f => f.subjects.length > 0)?.name || 'Unassigned';



  const filteredFaculty = faculty.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.subjects.some(sub => sub.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Transition helper to jump straight to student history explorer
  const inspectStudentInDetail = (studentId: string) => {
    setFocusedStudentId(studentId);
    setActiveTab('students');
  };

  // Checkbox interactions on batch lists
  const handleBatchCheckboxChange = (studentId: string, val: boolean) => {
    const updated = { ...batchCheckboxes, [studentId]: val };
    setBatchCheckboxes(updated);
    
    // Check if any is ticked
    const anyChecked = Object.values(updated).some(v => v === true);
    setShowBatchActionPopup(anyChecked);
  };

  const handleSelectAllInBatch = (stIds: string[], val: boolean) => {
    const updated = { ...batchCheckboxes };
    stIds.forEach(id => {
      updated[id] = val;
    });
    setBatchCheckboxes(updated);
    setShowBatchActionPopup(val);
  };

  const handleBatchBulkAction = (action: 'transfer' | 'remove' | 'unassign') => {
    const targetStudentIds = Object.keys(batchCheckboxes).filter(id => batchCheckboxes[id] === true);
    if (targetStudentIds.length === 0) return;

    if (action === 'remove') {
      const remainingStudents = students.filter(s => !targetStudentIds.includes(s.id));
      onUpdateStudents(remainingStudents);
    } else if (action === 'unassign') {
      const updatedStudents = students.map(s => {
        if (targetStudentIds.includes(s.id)) {
          return {
            ...s,
            batch: "Unassigned",
            batchId: "unassigned"
          };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);
    } else {
      // Transfer to the next available batch (cycle through batchSchedules)
      if (batchSchedules.length === 0) return;
      const currentIdx = batchSchedules.findIndex(b => b.batchId === selectedBatchId);
      const realBatches = batchSchedules.filter(b => b.batchId !== "unassigned");
      if (realBatches.length === 0) return;

      const nextBatch = realBatches[((currentIdx >= 0 ? currentIdx : 0) + 1) % realBatches.length];
      const updatedStudents = students.map(s => {
        if (targetStudentIds.includes(s.id)) {
          return {
            ...s,
            batch: nextBatch.batchName,
            batchId: nextBatch.batchId
          };
        }
        return s;
      });
      onUpdateStudents(updatedStudents);
    }

    setBatchCheckboxes({});
    setShowBatchActionPopup(false);
  };

  const handleAddBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    const cleanedTag = newBatchTag.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const generatedBatchId = `batch_${cleanedTag}_${Date.now()}`;

    if (batchSchedules.some(b => b.batchName.toLowerCase() === newBatchName.trim().toLowerCase())) {
      alert("A batch with this name already exists.");
      return;
    }

    const newBatch = {
      batchId: generatedBatchId,
      batchName: newBatchName.trim(),
      batchTag: newBatchTag.trim() || "Class",
      activeDays: newBatchActiveDays
    };

    onUpdateSettings({
      ...settings,
      batchSchedules: [...batchSchedules, newBatch]
    });

    setNewBatchName("");
    setNewBatchTag("");
    setNewBatchActiveDays([1, 3, 5]);
    setShowAddBatchForm(false);
    setSelectedBatchId(generatedBatchId);
  };

  const handleDeleteBatch = () => {
    if (selectedBatchId === "unassigned") return;
    const batchToDelete = batchSchedules.find(b => b.batchId === selectedBatchId);
    if (!batchToDelete) return;

    if (!window.confirm(`Are you sure you want to delete the batch "${batchToDelete.batchName}"? All students in this batch will be moved to "Unassigned".`)) {
      return;
    }

    const updatedBatches = batchSchedules.filter(b => b.batchId !== selectedBatchId);
    onUpdateSettings({
      ...settings,
      batchSchedules: updatedBatches
    });

    const updatedStudents = students.map(s => s.batchId === selectedBatchId
      ? { ...s, batch: "Unassigned", batchId: "unassigned" }
      : s
    );
    onUpdateStudents(updatedStudents);

    const updatedSessions = sessions.filter(sess => sess.batchId !== selectedBatchId);
    onUpdateSessions(updatedSessions);

    const nextBatchId = updatedBatches[0]?.batchId || "unassigned";
    setSelectedBatchId(nextBatchId);
    setBatchCheckboxes({});
    setShowBatchActionPopup(false);
  };

  // Notification resend simulation trigger
  const triggerResendMessage = (logId: string) => {
    setResendingLogId(logId);
    setTimeout(() => {
      setResendingLogId(null);
    }, 1200);
  };

  // Add new student from Quick Panel Form
  const handleRegisterStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRegName.trim()) return;

    const batchName = quickRegBatch === "unassigned" ? "Unassigned" : (batchLookup[quickRegBatch]?.batchName || quickRegBatch);

    const newS: Student = {
      id: `std_app_${Date.now()}`,
      name: quickRegName,
      email: `${quickRegName.toLowerCase().replace(/\s+/g, '')}@parent.mail`,
      parentName: `Parent of ${quickRegName.split(" ")[0]}`,
      parentPhone: quickRegPhone || "+91 91234 56789",
      batch: batchName,
      batchId: quickRegBatch,
      targetThreshold: 75,
      attendancePercentage: 100.0,
      status: "Active",
      stats: { total: 0, present: 0, absent: 0, excused: 0 },
      history: []
    };

    onAddStudent(newS);
    setQuickRegName("");
    setQuickRegPhone("");
    setShowRegisterForm(false);
  };

  const handleScheduleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionSubject.trim()) return;

    const selectedBatch = batchSchedules.find(b => b.batchId === newSessionBatchId);
    const newS: Session = {
      id: `sess_app_${Date.now()}`,
      batchName: selectedBatch ? selectedBatch.batchName : "Unassigned",
      batchTag: selectedBatch ? selectedBatch.batchTag : "Class",
      batchId: newSessionBatchId,
      subject: newSessionSubject.trim(),
      time: `${newSessionDate} @ ${newSessionTime.trim() || "10:15 AM"}`,
      room: newSessionRoom.trim() || "Room 102",
      studentsCount: getFilteredStudentsForBatch(newSessionBatchId).length,
      status: 'Upcoming',
      assignedFaculty: newSessionFaculty
    };

    onUpdateSessions([newS, ...sessions]);
    setNewSessionSubject("");
    setNewSessionTime("");
    setNewSessionRoom("");
    setNewSessionFaculty("");
    setShowAddSessionForm(false);
  };

  // Override attendance flag manually inside session records
  const applyOverridesToSession = (sessionId: string) => {
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          status: 'Marked' as const,
          presentCount: s.studentsCount - 1,
          absentCount: 1,
          markedBy: "Administrative Override"
        };
      }
      return s;
    });
    onUpdateSessions(updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen text-slate-800" id="admin_portal_container">
      
      {/* Sidebar navigation column */}
      <div className="lg:col-span-3 bg-white border-r border-[#dee2e6] p-5 flex flex-col gap-6" id="admin_sidebar_menu">
        <div className="flex items-center gap-3 px-1 mt-1">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-display font-black text-white text-base">
            ISH
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black font-display text-text-primary tracking-tight">Infinity Hub</h1>
            <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Admin Desk</span>
          </div>
        </div>
        <div className="bg-slate-50 border border-outline-variant rounded-lg px-3 py-2 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-black text-[10px]">
            {adminName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-text-primary leading-tight">{adminName}</span>
            <span className="text-[9px] text-gray-400 font-semibold">Signed in</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 leading-snug">
          {/* Navigation Item Cards */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'dashboard' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Academic Overview
          </button>

          <button
            onClick={() => setActiveTab('batches')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'batches' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <GraduationCap className="w-4 h-4" /> Batches Manager
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'students' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <Users className="w-4 h-4" /> Student Profiles
          </button>

          <button
            onClick={() => setActiveTab('faculty')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'faculty' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <UserCheck className="w-4 h-4" /> Faculty Directory
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'notifications' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <BellRing className="w-4 h-4" /> Parent Leave Alerts
          </button>

          <button
            onClick={() => setActiveTab('composer')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'composer' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <MessageSquare className="w-4 h-4" /> Broadcaster Form
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'calendar' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <CalendarDays className="w-4 h-4" /> Exceptions Calendar
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'reports' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics Reports
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'settings' ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:bg-slate-50"}`}
          >
            <SettingsIcon className="w-4 h-4" /> Portal Settings
          </button>
        </div>

        {/* Global search controller */}
        <div className="relative mt-auto border-t border-gray-100 pt-4 flex flex-col gap-2">
          <label className="text-[10px] font-bold text-gray-400">GLOBAL QUERY SEARCH</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8a909a] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter names..."
              className="text-[11px] w-full bg-slate-50 border border-outline-variant pl-8 pr-3 py-1.5 rounded-lg outline-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-[10px] text-[#ba1a1a] font-semibold text-center hover:underline self-center transition-all">
              Clear Filter Query
            </button>
          )}
        </div>
        <button
          onClick={onSignOut}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-[#ba1a1a] bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer"
          type="button"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>

      {/* Main Dynamic View Panels box */}
      <div className="lg:col-span-9 p-6 bg-[#f7fafc] min-h-screen overflow-x-hidden flex flex-col gap-6" id="admin_main_board">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8a909a] mb--2">
          <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary transition-colors cursor-pointer">
            Home
          </button>
          <span>/</span>
          <span className="text-text-primary">
            {activeTab === 'dashboard' ? 'Academic Overview' :
             activeTab === 'batches' ? 'Batches Manager' :
             activeTab === 'students' ? 'Student Profiles' :
             activeTab === 'faculty' ? 'Faculty Directory' :
             activeTab === 'notifications' ? 'Parent Leave Alerts' :
             activeTab === 'composer' ? 'Broadcaster Form' :
             activeTab === 'calendar' ? 'Exceptions Calendar' :
             activeTab === 'reports' ? 'Analytics Reports' :
             activeTab === 'settings' ? 'Portal Settings' : ''}
          </span>
        </div>
        
        {/* SUB VIEW 1: OVERVIEW DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 animate-fadeIn" id="dashboard_sub_view">
            {/* Page Title & Fast triggers */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-outline-variant">
              <div>
                <h2 className="text-xl font-black font-display tracking-tight text-text-primary">Today's Academic Activity Overview</h2>
                <p className="text-xs text-[#555a64] mt-0.5">Real-time stats and progress overview for running cohorts.</p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddSessionForm(!showAddSessionForm)}
                  className="text-xs font-display font-medium px-4 py-2.5 bg-[#107c41] hover:bg-[#0b5c30] text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  type="button"
                >
                  <Plus className="w-4 h-4" /> Schedule Session
                </button>
                <button
                  onClick={() => setShowRegisterForm(!showRegisterForm)}
                  className="text-xs font-display font-medium px-4 py-2.5 bg-[#1e73be] hover:bg-primary text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  type="button"
                >
                  <Plus className="w-4 h-4" /> Register Student
                </button>
              </div>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-outline-variant rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase">Aver. Attendance Index</span>
                  <p className="text-xl font-black font-display text-text-primary mt-1">{averageAttendanceValue}%</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">Target standard: 75%</p>
                </div>
                <div className="p-3 bg-secondary-fixed rounded-xl text-on-secondary-fixed">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-[#dee2e6] rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase">Sessions Marked Today</span>
                  <p className="text-xl font-black font-display text-[#107c41] mt-1">{markedSessionsCount} / {totalSessionsCount}</p>
                  <p className="text-[10px] text-[#107c41] font-bold mt-0.5">
                    {Math.round((markedSessionsCount / (totalSessionsCount || 1)) * 100)}% Complete
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-[#107c41] border border-emerald-100">
                  <FileCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-[#dee2e6] rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase">Pending Submissions</span>
                  <p className="text-xl font-black font-display text-amber-700 mt-1">{unmarkedSessionsCount}</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">Reminders dispatched</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-amber-800 border border-amber-100">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white border border-[#dee2e6] rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase">Staff Submission Ratio</span>
                  <p className="text-xl font-black font-display text-text-primary mt-1">
                    {(faculty.reduce((sum, f) => sum + f.submissionRate, 0) / Math.max(faculty.length, 1)).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#107c41] font-bold mt-0.5">High Faculty Trust</p>
                </div>
                <div className="p-3 bg-zinc-100 rounded-xl text-slate-800">
                  <Smartphone className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quick Registration Form popup Modal overlay */}
            {showRegisterForm && (
              <div className="p-5 bg-white border border-outline-variant rounded-2xl shadow-md flex flex-col gap-4 animate-slideDown max-w-md">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-black font-display text-text-primary uppercase tracking-wide">Quick Register Student Card</h3>
                  <button onClick={() => setShowRegisterForm(false)} className="p-1 hover:bg-slate-100 rounded-full cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleRegisterStudentSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">STUDENT FULL NAME</label>
                    <input type="text" required placeholder="Full name" className="text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" value={quickRegName} onChange={(e) => setQuickRegName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">PARENT PRIMARY MOBILE</label>
                    <input type="text" placeholder="Parent phone number" className="text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" value={quickRegPhone} onChange={(e) => setQuickRegPhone(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">SELECT INTRODUCTORY BATCH</label>
                    <select className="text-xs p-2 border border-outline-variant rounded-lg bg-white" value={quickRegBatch} onChange={(e) => setQuickRegBatch(e.target.value)}>
                      <option value="unassigned">Unassigned / No Batch</option>
                      {batchSchedules.map(b => (
                        <option key={b.batchId} value={b.batchId}>{b.batchName}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="text-xs font-bold py-2 bg-primary text-white rounded-lg hover:bg-primary-container cursor-pointer mt-2 text-center">
                    Confirm Registration Roster
                  </button>
                </form>
              </div>
            )}

            {/* Quick Add Session Form popup Modal overlay */}
            {showAddSessionForm && (
              <div className="p-5 bg-white border border-outline-variant rounded-2xl shadow-md flex flex-col gap-4 animate-slideDown max-w-md">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-black font-display text-text-primary uppercase tracking-wide">Schedule Daily Session</h3>
                  <button onClick={() => setShowAddSessionForm(false)} className="p-1 hover:bg-slate-100 rounded-full cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleScheduleSessionSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">SELECT COHORT BATCH</label>
                    <select 
                      className="text-xs p-2 border border-outline-variant rounded-lg bg-white" 
                      value={newSessionBatchId} 
                      onChange={(e) => setNewSessionBatchId(e.target.value)}
                    >
                      <option value="unassigned">Unassigned / No Batch</option>
                      {batchSchedules.map(b => (
                        <option key={b.batchId} value={b.batchId}>{b.batchName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">SESSION SUBJECT</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Physics, Chemistry" 
                      className="text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" 
                      value={newSessionSubject} 
                      onChange={(e) => setNewSessionSubject(e.target.value)} 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">SLOT TIME</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. 10:15 AM" 
                      className="text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" 
                      value={newSessionTime} 
                      onChange={(e) => setNewSessionTime(e.target.value)} 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">ROOM / LOCATION</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Room 102" 
                      className="text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" 
                      value={newSessionRoom} 
                      onChange={(e) => setNewSessionRoom(e.target.value)} 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">ASSIGN FACULTY</label>
                    <select 
                      className="text-xs p-2 border border-outline-variant rounded-lg bg-white" 
                      value={newSessionFaculty} 
                      onChange={(e) => setNewSessionFaculty(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {faculty.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="text-xs font-bold py-2 bg-[#107c41] text-white rounded-lg hover:bg-[#0b5c30] cursor-pointer mt-2 text-center">
                    Confirm Session Schedule
                  </button>
                </form>
              </div>
            )}

            {/* Asymmetric main body grid: Roster tracking progress vs sidebar lists */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Daily sessions progress ledger */}
              <div className="lg:col-span-8 bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                <div className="border-b border-outline-variant pb-3 justify-between items-center flex">
                  <div>
                    <h3 className="text-sm font-bold font-display text-text-primary tracking-wide uppercase">Today's Class Session Schedules</h3>
                    <p className="text-[11px] text-[#555a64] mt-0.5">Faculty marking status table check list.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#dee2e6] text-[#8a909a] font-bold">
                        <th className="p-3">Batch & Track</th>
                        <th className="p-3">Session Subject</th>
                        <th className="p-3">Slot Time</th>
                        <th className="p-3">Assigned Faculty</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Overrides Or Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {sessions.map(session => {
                        const isMarked = session.status === 'Marked';
                        const isCancelled = session.status === 'Cancelled';
                        return (
                          <tr key={session.id} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-text-primary capitalize">{session.batchName}</td>
                            <td className="p-3 text-gray-500 font-semibold">{session.subject}</td>
                            <td className="p-3 text-gray-500 font-semibold">{session.time}</td>
                            <td className="p-3">
                              <select
                                value={session.assignedFaculty || ""}
                                onChange={(e) => {
                                  const newFacultyName = e.target.value;
                                  const updated = sessions.map(s => s.id === session.id
                                    ? { ...s, assignedFaculty: newFacultyName }
                                    : s
                                  );
                                  onUpdateSessions(updated);
                                }}
                                className="text-[10.5px] font-bold bg-white border border-outline-variant rounded-lg px-2 py-1 outline-primary cursor-pointer max-w-[150px] truncate"
                              >
                                <option value="">Unassigned</option>
                                {faculty.map(f => (
                                  <option key={f.id} value={f.name}>{f.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3">
                              {isMarked ? (
                                <span className="text-[10px] font-bold text-[#107c41] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-0.5 w-fit">
                                  ✓ Marked
                                </span>
                              ) : isCancelled ? (
                                <span className="text-[10px] font-bold text-[#ba1a1a] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 flex items-center gap-0.5 w-fit">
                                  Cancelled
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100 flex items-center gap-0.5 w-fit animate-pulse">
                                  ● Pending
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isMarked ? (
                                <span className="text-[10px] text-emerald-800 font-bold bg-white px-2 py-1 rounded">
                                  P: {session.presentCount} | A: {session.absentCount}
                                </span>
                              ) : isCancelled ? (
                                <span className="text-[10px] text-[#8a909a] font-normal italic">No logs required</span>
                              ) : (
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => applyOverridesToSession(session.id)}
                                    className="text-[10px] font-bold bg-white hover:bg-slate-100 border border-outline-variant px-2.5 py-1 rounded-md text-primary cursor-pointer flex items-center gap-0.5"
                                  >
                                    Force Mark Present
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar List Cards: At risk students and Recent Submissions timeline */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* At-Risk Students list limit 4 */}
                <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col gap-3">
                  <div className="justify-between items-center flex border-b pb-2">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1">
                      <AlertOctagon className="w-4 h-4 text-[#ba1a1a]" />
                      At-Risk Students (&lt;75%)
                    </span>
                    <span className="text-[10px] font-bold bg-red-50 text-[#ba1a1a] px-2 py-0.5 rounded-full">
                      {students.filter(s => s.attendancePercentage < 75).length} At Risk
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                    {students.filter(s => s.attendancePercentage < 75).slice(0, 4).map(student => (
                      <div
                        key={student.id}
                        onClick={() => inspectStudentInDetail(student.id)}
                        className="p-2 border border-outline-variant hover:border-red-400 bg-[#fbfcfd] hover:bg-red-50/10 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-100"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full border bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">{student.name.charAt(0)}</div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-text-primary leading-tight">{student.name}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-absent-red bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-display">
                          {student.attendancePercentage}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveTab('students')}
                    className="text-center text-[10.5px] font-bold text-primary hover:underline flex items-center justify-center gap-0.5 mt-1"
                  >
                    Manage Student Rosters <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Recent submissions timeline logger — real session data */}
                <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col gap-3">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wide border-b pb-2">
                    Recent Session Activity
                  </span>

                  <div className="flex flex-col gap-3 pl-1.5 border-l-2 border-slate-100 ml-1.5">
                    {sessions.filter(s => s.status === 'Marked').slice(0, 3).length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No marked sessions yet.</p>
                    ) : (
                      sessions.filter(s => s.status === 'Marked').slice(0, 3).map(session => (
                        <div key={session.id} className="relative">
                          <div className="absolute -left-3.5 top-1.5 w-2 h-2 rounded-full bg-[#107c41]" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{session.time}</span>
                          <p className="text-xs font-semibold text-text-primary leading-tight mt-0.5">{session.batchName} — {session.subject}</p>
                          <span className="text-[9.5px] text-gray-400">
                            {session.markedBy ? `By ${session.markedBy}` : 'Marked'} · P:{session.presentCount ?? 0} A:{session.absentCount ?? 0}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Asymmetric Bento Footer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-outline-variant rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full border border-primary/10 pointer-events-none" />
                <span className="text-[9px] font-bold text-primary tracking-widest uppercase">System Status</span>
                <h4 className="text-sm font-bold font-display text-text-primary mt-1">Evening Submission Window</h4>
                <p className="text-xs text-[#555a64] leading-relaxed">
                  The strict evening submission window closes at the configured time. Sessions not marked by then will be flagged as pending.
                </p>
              </div>

              <div className="bg-white border border-outline-variant rounded-2xl p-5 flex flex-col gap-2">
                <span className="text-[9px] font-bold text-emerald-800 tracking-widest uppercase">Weekly Analytics</span>
                <h4 className="text-sm font-bold font-display text-text-primary mt-1">Weekly Presence Index Reports Prepared</h4>
                <p className="text-xs text-[#555a64] leading-relaxed">
                  Parent digest channels generated successfully for standard cohorts. Click down to export custom sheets.
                </p>
                <button onClick={() => setActiveTab('reports')} className="text-left text-xs text-primary font-bold hover:underline flex items-center gap-0.5 mt-2">
                  View report charts <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB VIEW 2: BATCHES MANAGEMENT (WITH SYSTEM CHECKOUT BULK MULTI-SELECT ACTION FLOATING CARD!) */}
        {activeTab === 'batches' && (
          <div className="flex flex-col gap-6 animate-fadeIn" id="batches_sub_view">
            {/* Batch selects */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-2xl border border-outline-variant gap-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-black font-display tracking-tight text-text-primary">Cohorts Enrollment & Batch Rosters</h2>
                <p className="text-xs text-[#555a64]">Review batches, execute bulk transfers, and clean target databases.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedBatchId}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    setBatchCheckboxes({});
                    setShowBatchActionPopup(false);
                  }}
                  className="text-xs font-bold leading-normal bg-white border border-[#dee2e6] rounded-xl px-4 py-2 outline-primary cursor-pointer"
                >
                  {batchSchedules.map(b => (
                    <option key={b.batchId} value={b.batchId}>{b.batchName} ({b.batchTag})</option>
                  ))}
                  <option value="unassigned">Unassigned / No Batch</option>
                </select>

                <button
                  onClick={() => setShowAddBatchForm(!showAddBatchForm)}
                  className="text-xs font-display font-medium px-4 py-2 bg-[#1e73be] hover:bg-primary text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  type="button"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Batch
                </button>

                {selectedBatchId !== "unassigned" && (
                  <button
                    onClick={handleDeleteBatch}
                    className="text-xs font-display font-medium px-4 py-2 bg-red-50 hover:bg-red-100 text-[#ba1a1a] border border-red-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                    type="button"
                  >
                    <X className="w-3.5 h-3.5" /> Remove Batch
                  </button>
                )}
              </div>
            </div>

            {/* Add Batch Form Card */}
            {showAddBatchForm && (
              <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4 animate-slideDown max-w-lg">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-xs font-black font-display text-text-primary uppercase tracking-wide">Create New Batch</h3>
                  <button onClick={() => setShowAddBatchForm(false)} className="p-1 hover:bg-slate-100 rounded-full cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleAddBatchSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400">BATCH NAME</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Pinnacle Class-11 JEE" 
                        className="text-xs p-2.5 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" 
                        value={newBatchName} 
                        onChange={(e) => setNewBatchName(e.target.value)} 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400">BATCH TAG / CODE</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. 11-JEE" 
                        className="text-xs p-2.5 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]" 
                        value={newBatchTag} 
                        onChange={(e) => setNewBatchTag(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400">ACTIVE WEEKDAYS FOR CLASSES</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6].map(dayIndex => {
                        const daysShort = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                        const dayLabel = daysShort[dayIndex];
                        const isChecked = newBatchActiveDays.includes(dayIndex);

                        const handleToggle = () => {
                          setNewBatchActiveDays(prev => 
                            isChecked ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
                          );
                        };

                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={handleToggle}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center justify-center transition-all ${
                              isChecked
                                ? "bg-primary text-white border-primary shadow-xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {dayLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end mt-2">
                    <button 
                      type="button" 
                      onClick={() => setShowAddBatchForm(false)} 
                      className="text-xs font-bold px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="text-xs font-bold px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-container cursor-pointer"
                    >
                      Create Batch
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Core statistics cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-xl p-4 flex flex-col gap-1.5 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400">BATCH SCHEDULING CALENDAR</span>
                <span className="text-base font-black text-text-primary font-display mt-0.5">{selectedBatchScheduleLabel}</span>
              </div>
              <div className="bg-white border rounded-xl p-4 flex flex-col gap-1.5 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400">LEAD FACULTY TEAM MEMBER</span>
                <span className="text-base font-black text-[#1e73be] font-display mt-0.5">{selectedBatchLeadFaculty}</span>
              </div>
              <div className="bg-white border rounded-xl p-4 flex flex-col gap-1.5 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400">ACTIVE ENROLLMENT COUNT</span>
                <span className="text-base font-black text-text-primary font-display mt-0.5">
                  {getFilteredStudentsForBatch(selectedBatchId).length} Active Students Mapped
                </span>
              </div>
            </div>

            {/* Students table under batch with checkboxes */}
            <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center border-b pb-3.5">
                <span className="text-xs font-bold text-text-primary">COHORT STUDENTS LIST</span>
                <label className="text-xs font-bold text-primary flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded accent-primary w-3.5 h-3.5"
                    onChange={(e) => handleSelectAllInBatch(getFilteredStudentsForBatch(selectedBatchId).map(s => s.id), e.target.checked)}
                  />
                  <span>Select All Students ({getFilteredStudentsForBatch(selectedBatchId).length})</span>
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-gray-400 font-bold border-b border-[#dee2e6]">
                      <th className="p-3 w-10">Select</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3 text-center">Attendance</th>
                      <th className="p-3 text-right">Assign Batch</th>
                      <th className="p-3 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {getFilteredStudentsForBatch(selectedBatchId).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-[#8a909a] italic">
                          {selectedBatchId === "unassigned"
                            ? "No unassigned students. All students belong to active cohorts."
                            : "No students are registered in this batch. Load students using the Student profiles CSV importer tab!"}
                        </td>
                      </tr>
                    ) : (
                      getFilteredStudentsForBatch(selectedBatchId).map(student => {
                        const isChecked = batchCheckboxes[student.id] || false;
                        return (
                          <tr key={student.id} className={`hover:bg-slate-50/80 transition-colors ${isChecked ? "bg-primary/5" : ""}`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleBatchCheckboxChange(student.id, e.target.checked)}
                                className="rounded accent-primary w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full border bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">{student.name.charAt(0)}</div>
                              <span className="font-bold text-text-primary">{student.name}</span>
                            </td>
                            <td className="p-3 font-semibold text-gray-500 truncate max-w-[180px]" title={student.email}>{student.email || '—'}</td>
                            <td className="p-3 text-center">
                              <span className={`text-xs font-black font-display rounded-full px-2.5 py-0.5 border ${
                                student.attendancePercentage < 75 ? "bg-red-50 text-absent-red border-red-100" : "bg-emerald-50 text-present-green border-emerald-100"
                              }`}>
                                {student.attendancePercentage}%
                              </span>
                            </td>
                            <td className="p-3 text-right">
                               <select
                                 value={studentBatchOverrides[student.id] ?? (student.batchId || "unassigned")}
                                 onChange={(e) => {
                                   const newBatchId = e.target.value;
                                   setStudentBatchOverrides(prev => ({ ...prev, [student.id]: newBatchId }));
                                   const newBatch = batchSchedules.find(b => b.batchId === newBatchId);
                                   const updated = students.map(s => s.id === student.id
                                     ? {
                                         ...s,
                                         batch: newBatch ? newBatch.batchName : "Unassigned",
                                         batchId: newBatch ? newBatch.batchId : "unassigned"
                                       }
                                     : s
                                   );
                                   onUpdateStudents(updated);
                                 }}
                                 className="text-[10px] font-bold bg-white border border-outline-variant rounded-lg px-2 py-1.5 outline-primary cursor-pointer max-w-[180px]"
                               >
                                 <option value="unassigned">Unassigned / No Batch</option>
                                 {batchSchedules.map(b => (
                                   <option key={b.batchId} value={b.batchId}>{b.batchName}</option>
                                 ))}
                               </select>
                             </td>
                             <td className="p-3 text-center">
                               {student.batchId && student.batchId !== "unassigned" && student.batch !== "Unassigned" && (
                                 <button
                                   onClick={() => {
                                     const updated = students.map(s => s.id === student.id
                                       ? { ...s, batch: "Unassigned", batchId: "unassigned" }
                                       : s
                                     );
                                     onUpdateStudents(updated);
                                   }}
                                   className="text-[10px] font-bold text-absent-red hover:text-red-800 hover:underline bg-red-50 hover:bg-red-100/50 px-2.5 py-1 rounded-md transition-colors cursor-pointer border border-red-100"
                                   type="button"
                                 >
                                   Unassign
                                 </button>
                               )}
                             </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BULK SELECTION ACTION BANNER (FLOATING COISED CHECKOUT INTERACTION) */}
            {showBatchActionPopup && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-4.5 px-6 shadow-2xl flex items-center gap-6 z-50 justify-between animate-slideUp min-w-[500px]">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-400">ROSTER BATCH COHORT MULTI-SELECT</span>
                  <span className="text-xs font-black text-white mt-1">
                    {Object.values(batchCheckboxes).filter(v => v === true).length} Students Selected
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleBatchBulkAction('transfer')}
                    className="text-xs font-display font-bold py-2 px-3 bg-primary text-white hover:bg-primary-container rounded-xl flex items-center gap-1.5 cursor-pointer border border-[#dee2e6]/20"
                    type="button"
                  >
                    Transfer Selected Batch
                  </button>

                  <button
                    onClick={() => handleBatchBulkAction('unassign')}
                    className="text-xs font-display font-bold py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer border border-amber-600/20"
                    type="button"
                  >
                    Unassign Selected
                  </button>

                  <button
                    onClick={() => handleBatchBulkAction('remove')}
                    className="text-xs font-display font-bold py-2 px-3 bg-absent-red hover:bg-red-800 text-white rounded-xl flex items-center gap-1.5 cursor-pointer border-none"
                    type="button"
                  >
                    Delete Selected From Portal
                  </button>

                  <button
                    onClick={() => {
                      setBatchCheckboxes({});
                      setShowBatchActionPopup(false);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB VIEW 3: STUDENT DETAIL TIMELINE LOGS & CSV BULK IMPORTER COMBINED */}
        {activeTab === 'students' && (
          <div className="flex flex-col gap-6 animate-fadeIn" id="students_sub_view">
            {/* Student Search Select Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-outline-variant">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-black font-display tracking-tight text-text-primary">Student Attendance History Detail</h2>
                <p className="text-xs text-[#555a64]">Inspect records, check yearly presence calendar mapping grids, and merge CSV lists.</p>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8a909a] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={studentSearchQuery}
                    onChange={(e) => {
                      const query = e.target.value;
                      setStudentSearchQuery(query);
                      const filtered = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
                      if (filtered.length > 0 && !filtered.some(s => s.id === focusedStudentId)) {
                        setFocusedStudentId(filtered[0].id);
                      }
                    }}
                    className="text-xs pl-8 pr-3 py-1.5 bg-[#fafbfd] border border-[#dee2e6] rounded-xl outline-primary w-44 font-semibold"
                  />
                </div>

                <select
                  value={focusedStudentId}
                  onChange={(e) => setFocusedStudentId(e.target.value)}
                  className="text-xs font-bold leading-normal bg-white border border-[#dee2e6] rounded-xl px-4 py-2 outline-primary cursor-pointer select-none max-w-[220px]"
                >
                  {students.filter(s => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase())).length === 0 ? (
                    <option value="">No matching students</option>
                  ) : (
                    students.filter(s => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase())).map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.attendancePercentage}%</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Split layout: Details Board vs CSV Importer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Focused Student detailed file block */}
              {(() => {
                const s = students.find(std => std.id === focusedStudentId) || students[0];
                if (!s) return <div className="lg:col-span-8 bg-white p-6 text-center italic text-gray-400">Select a student from the profile explorer.</div>;

                const isAtRisk = s.attendancePercentage < s.targetThreshold;

                return (
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Profile Panel Banner */}
                    <div className="bg-white border rounded-2xl p-5 flex flex-col md:flex-row shadow-xs gap-5 relative overflow-hidden">
                      {isAtRisk && (
                        <div className="absolute right-0 top-0 bg-[#ba1a1a] text-white font-bold p-1 px-4 text-[9px] rounded-bl-xl tracking-wider animate-pulse flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5" /> CRITICAL ATTENDANCE WARNING
                        </div>
                      )}
                      
                      <div className="w-20 h-20 rounded-2xl border bg-primary/10 text-primary font-black text-2xl flex items-center justify-center shrink-0 mx-auto md:mx-0 shadow-sm">{s.name.charAt(0)}</div>
                      
                      <div className="flex-1 text-center md:text-left flex flex-col md:justify-center">
                        <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full self-center md:self-start mb-1 uppercase tracking-wider">
                          Cohort: {s.batch}
                        </span>
                        <h3 className="text-lg font-black font-display text-text-primary leading-tight mt-0.5">{s.name}</h3>
                        <p className="text-xs text-[#555a64] mt-1.5 flex flex-wrap justify-center md:justify-start items-center gap-2 gap-y-1">
                          <span>Parent: {s.parentName} (<b className="font-bold text-gray-700">{s.parentPhone}</b>)</span>
                        </p>
                      </div>

                      {/* Presence gauge meter */}
                      <div className="border-l pl-5 flex flex-col justify-center items-center shrink-0">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Current Presence</span>
                        <span className={`text-2xl font-black font-display tracking-tight mt-1 ${isAtRisk ? "text-absent-red" : "text-present-green"}`}>
                          {s.attendancePercentage}%
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border mt-1.5 ${isAtRisk ? "bg-red-50 text-absent-red border-red-100" : "bg-emerald-50 text-present-green border-emerald-100"}`}>
                          {isAtRisk ? "At Risk" : "Stable"}
                        </span>
                      </div>
                    </div>

                    {/* Threshold info card */}
                    {isAtRisk && (
                      <div className="p-3.5 bg-red-50 border border-red-200/90 rounded-2xl text-xs text-absent-red flex items-start gap-2.5 font-medium leading-relaxed">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-absent-red" />
                        <div>
                          <p className="font-bold text-red-950">Safe Level Threshold (75%) Deficit Alert</p>
                          <p className="text-red-900 mt-0.5">
                            {s.name}'s current attendance score is {s.attendancePercentage}%. They must attend a minimum of {Math.ceil((0.75 * s.stats.total) - s.stats.present)} subsequent sessions to safely re-establish positive participation standing above threshold levels.
                          </p>
                        </div>
                      </div>
                    )}



                    {/* Detailed Historical Sessions list */}
                    <div className="bg-white border rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wide border-b pb-2">
                        Session Presence History Timeline logs
                      </span>

                      <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                        {s.history.length === 0 ? (
                          <div className="text-center p-6 text-gray-400 italic">No attendance records registered for this student.</div>
                        ) : (
                          s.history.map(rec => {
                            const isPresent = rec.status === 'Present';
                            return (
                              <div key={rec.id} className="border border-outline-variant p-3 rounded-xl flex justify-between items-center bg-[#fafbfd] hover:bg-white transition-colors duration-100">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-bold text-gray-400">{rec.date} • {rec.time}</span>
                                  <h4 className="text-xs font-bold text-text-primary mt-0.5">{rec.subject}</h4>
                                  <p className="text-[10px] text-zinc-500">Instructor: {rec.markedBy}</p>
                                </div>

                                <span className={`text-[10px] font-bold rounded-md px-2.5 py-1 border ${
                                  isPresent 
                                    ? "bg-emerald-50 text-present-green border-emerald-200" 
                                    : rec.status === 'Excused' 
                                      ? "bg-amber-50 text-amber-800 border-amber-200" 
                                      : "bg-red-50 text-absent-red border-red-200"
                                }`}>
                                  {rec.status}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CSV Upload panel on the right */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <CSVImporter
                  onImport={(newStds) => {
                    // Update main student lists
                    onImportStudents(newStds);
                    if (newStds.length > 0) {
                      setFocusedStudentId(newStds[0].id);
                    }
                  }}
                  existingBatches={Array.from(new Set(students.map(s => s.batch)))}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faculty' && (
          <div className="flex flex-col gap-6 animate-fadeIn" id="faculty_sub_view">
            <div className="bg-white p-4 rounded-2xl border border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black font-display tracking-tight text-text-primary">Faculty Directory</h2>
                <p className="text-xs text-[#555a64] mt-0.5">Add teachers manually with their name, phone number and subjects. Edit or remove any time.</p>
              </div>
              <button
                onClick={() => setShowAddFacultyForm(v => !v)}
                className="text-xs font-display font-bold px-4 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Faculty
              </button>
            </div>

            {/* Add Faculty Form */}
            {showAddFacultyForm && (
              <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs animate-slideDown">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black font-display text-text-primary uppercase tracking-wide">New Faculty Record</h3>
                  <button onClick={() => setShowAddFacultyForm(false)} className="p-1 hover:bg-slate-100 rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleAddFacultySubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter faculty full name"
                        value={newFacultyName}
                        onChange={e => setNewFacultyName(e.target.value)}
                        className="text-xs p-2.5 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="Enter 10-digit phone number"
                        value={newFacultyPhone}
                        onChange={e => setNewFacultyPhone(e.target.value)}
                        className="text-xs p-2.5 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Subjects</label>
                    {/* Selected subject tags */}
                    <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                      {newFacultySubjects.length === 0 && <span className="text-xs text-gray-400 italic">No subjects selected yet.</span>}
                      {newFacultySubjects.map((sub, i) => (
                        <span key={i} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                          {sub}
                          <button type="button" onClick={() => setNewFacultySubjects(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-red-500 cursor-pointer"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    {/* Quick-add chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_SUBJECTS.filter(s => !newFacultySubjects.includes(s)).map(sub => (
                        <button type="button" key={sub}
                          onClick={() => setNewFacultySubjects(prev => [...prev, sub])}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer transition-all"
                        >+ {sub}</button>
                      ))}
                    </div>
                    {/* Custom subject input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Custom subject..."
                        value={newFacultySubjectInput}
                        onChange={e => setNewFacultySubjectInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newFacultySubjectInput.trim() && !newFacultySubjects.includes(newFacultySubjectInput.trim())) {
                              setNewFacultySubjects(prev => [...prev, newFacultySubjectInput.trim()]);
                            }
                            setNewFacultySubjectInput("");
                          }
                        }}
                        className="flex-1 text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-[#fafbfd]"
                      />
                      <button type="button"
                        onClick={() => {
                          if (newFacultySubjectInput.trim() && !newFacultySubjects.includes(newFacultySubjectInput.trim())) {
                            setNewFacultySubjects(prev => [...prev, newFacultySubjectInput.trim()]);
                          }
                          setNewFacultySubjectInput("");
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer hover:bg-slate-200"
                      >Add</button>
                    </div>
                  </div>

                  <button type="submit" className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-primary-container flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Save Faculty Member
                  </button>
                </form>
              </div>
            )}

            {/* Faculty list with inline subject editor */}
            <div className="flex flex-col gap-4">
              {filteredFaculty.length === 0 ? (
                <div className="bg-white border border-outline-variant rounded-2xl p-10 text-center flex flex-col items-center gap-3">
                  <BookOpen className="w-10 h-10 text-gray-200" />
                  <div>
                    <p className="text-sm font-bold text-gray-400">No faculty members yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Click <strong>Add Faculty</strong> above to add your first teacher.</p>
                  </div>
                  <button
                    onClick={() => setShowAddFacultyForm(true)}
                    className="mt-1 text-xs font-bold px-4 py-2 bg-primary text-white rounded-xl cursor-pointer hover:bg-primary-container flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Faculty Member
                  </button>
                </div>
              ) : (
                filteredFaculty.map(f => {
                  const isEditing = editingFacultyId === f.id;
                  const isOnLeave = f.status === 'On Leave';
                  return (
                    <div key={f.id} className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                      {/* Faculty Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center shrink-0">{f.name.charAt(0)}</div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-text-primary text-sm">{f.name}</span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
                              {f.phone ? (
                                <><span className="text-gray-300">📞</span>{f.phone}</>
                              ) : (
                                <span className="italic text-gray-300">No phone on record</span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider">Submission Rate</span>
                            <span className="text-sm font-black text-slate-800">{f.submissionRate}%</span>
                          </div>
                          <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 border inline-block ${
                            isOnLeave ? "bg-red-50 text-absent-red border-red-100" : "bg-emerald-50 text-present-green border-emerald-100"
                          }`}>
                            {f.status}
                          </span>
                          <button
                            onClick={() => {
                              if (isEditing) {
                                setEditingFacultyId(null);
                                setEditSubjects([]);
                                setNewSubjectInput("");
                              } else {
                                setEditingFacultyId(f.id);
                                setEditSubjects([...f.subjects]);
                                setNewSubjectInput("");
                              }
                            }}
                            className={`p-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                              isEditing ? "bg-primary text-white border-primary" : "bg-slate-50 text-primary border-outline-variant hover:bg-primary/5"
                            }`}
                          >
                            {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                            {isEditing ? "Done" : "Edit"}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${f.name} from the faculty list?`)) {
                                onDeleteFaculty(f.id);
                              }
                            }}
                            className="p-1.5 rounded-xl border border-red-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer bg-red-50 text-absent-red hover:bg-red-100 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subject Tags (view mode) */}
                      {!isEditing && (
                        <div className="flex flex-wrap gap-1.5">
                          {f.subjects.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">No subjects assigned yet — click Edit Subjects to assign.</span>
                          ) : (
                            f.subjects.map((sub, i) => (
                              <span key={i} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                                {sub}
                              </span>
                            ))
                          )}
                        </div>
                      )}

                      {/* Subject Editor Panel (edit mode) */}
                      {isEditing && (
                        <div className="bg-slate-50 border border-outline-variant rounded-xl p-4 flex flex-col gap-3 animate-slideDown">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assigned Subjects</span>
                          
                          {/* Current subjects with remove buttons */}
                          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                            {editSubjects.length === 0 && (
                              <span className="text-xs text-gray-400 italic">No subjects assigned.</span>
                            )}
                            {editSubjects.map((sub, i) => (
                              <span key={i} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                                {sub}
                                <button
                                  onClick={() => setEditSubjects(prev => prev.filter((_, idx) => idx !== i))}
                                  className="ml-0.5 hover:text-red-500 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>

                          {/* Quick-add from common subjects */}
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1.5">Quick Add</span>
                            <div className="flex flex-wrap gap-1.5">
                              {COMMON_SUBJECTS.filter(s => !editSubjects.includes(s)).map(sub => (
                                <button
                                  key={sub}
                                  onClick={() => setEditSubjects(prev => [...prev, sub])}
                                  className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer transition-all"
                                >
                                  + {sub}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom subject input */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Custom subject name..."
                              value={newSubjectInput}
                              onChange={(e) => setNewSubjectInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newSubjectInput.trim()) {
                                  if (!editSubjects.includes(newSubjectInput.trim())) {
                                    setEditSubjects(prev => [...prev, newSubjectInput.trim()]);
                                  }
                                  setNewSubjectInput("");
                                }
                              }}
                              className="flex-1 text-xs p-2 border border-outline-variant rounded-lg outline-primary bg-white"
                            />
                            <button
                              onClick={() => {
                                if (newSubjectInput.trim() && !editSubjects.includes(newSubjectInput.trim())) {
                                  setEditSubjects(prev => [...prev, newSubjectInput.trim()]);
                                }
                                setNewSubjectInput("");
                              }}
                              className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-primary-container"
                            >
                              Add
                            </button>
                          </div>

                          {/* Save Button */}
                          <button
                            onClick={() => {
                              onUpdateFaculty(f.id, { subjects: editSubjects });
                              setEditingFacultyId(null);
                              setEditSubjects([]);
                              setNewSubjectInput("");
                            }}
                            className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-primary-container flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Save Subject Assignments
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SUB VIEW 5: PARENT LEAVE ALERTS NOTIFICATION LOG */}
        {activeTab === 'notifications' && (
          <div className="flex flex-col gap-6 animate-fadeIn" id="notifications_sub_view">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-outline-variant">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-black font-display tracking-tight text-text-primary">Parent Notification Dispatch Records</h2>
                <p className="text-xs text-[#555a64] mt-0.5">Verify deliverability logs, check channels (WhatsApp / Email) and retry failed deliveries.</p>
              </div>
            </div>

            {/* Quick Metrics display bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4 flex flex-col gap-1 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400">TOTAL COMMUNICATIONS TODAY</span>
                <span className="text-lg font-black text-slate-800 font-display mt-0.5">{notificationLogs.length} Dispatches</span>
              </div>
              <div className="bg-white border rounded-xl p-4 flex flex-col gap-1 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400">WHATSAPP DELIVERABILITY SUCCESS</span>
                <span className="text-lg font-black text-emerald-800 font-display mt-0.5">
                  {notificationLogs.length > 0 ? ((notificationLogs.filter(l => l.status === 'Delivered').length / notificationLogs.length) * 100).toFixed(1) : 0}% Success Rate
                </span>
              </div>
            </div>

            {/* Notification logs data table */}
            <div className="bg-white border text-xs rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide border-b pb-3 block">
                DELIVERY HISTORIES LOG
              </span>

              <div className="overflow-x-auto animate-fadeIn">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-gray-400 font-bold border-b border-[#dee2e6]">
                      <th className="p-3">Addressed Parent Recipient</th>
                      <th className="p-3">Delivery Channel</th>
                      <th className="p-3 w-72">Dispatched Message Body Content</th>
                      <th className="p-3">Log Timestamp</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {notificationLogs.map(log => {
                      const isFailed = log.status === 'Failed';
                      const isResending = resendingLogId === log.id;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-800">{log.recipient}</td>
                          <td className="p-3 capitalize text-gray-500 font-bold">{log.channel}</td>
                          <td className="p-3 text-[#555a64] font-medium leading-relaxed">{log.message}</td>
                          <td className="p-3 text-gray-400 font-bold">{log.timestamp}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                              isFailed ? "bg-red-50 text-absent-red border-red-100" : "bg-emerald-50 text-present-green border-emerald-100"
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {isFailed && (
                              <button
                                onClick={() => triggerResendMessage(log.id)}
                                disabled={isResending}
                                className="text-[10px] font-bold bg-[#ba1a1a]/10 hover:bg-[#ba1a1a]/20 text-[#ba1a1a] px-2.5 py-1.5 rounded-lg border border-[#ba1a1a]/30 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                              >
                                {isResending ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Retrying...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3" />
                                    Retry Send
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUB VIEW 6: COMPOSER (MANUAL BROADCASTER WITH MOBILE PREVIEW WINDOW) */}
        {activeTab === 'composer' && (
          <div className="animate-fadeIn">
            <BroadcastComposer
              students={students}
              templates={templates}
              onSend={onSendBroadcast}
            />
          </div>
        )}

        {/* SUB VIEW 7: CALENDAR & EXCEPTIONS VIEW */}
        {activeTab === 'calendar' && (
          <div className="animate-fadeIn">
            <CalendarView
              holidays={holidays}
              onAddHoliday={onAddHoliday}
              onDeleteHoliday={onDeleteHoliday}
              batchSchedules={settings.batchSchedules || []}
              onUpdateBatchSchedule={(updated) => {
                onUpdateSettings({
                  ...settings,
                  batchSchedules: updated
                });
              }}
            />
          </div>
        )}

        {/* SUB VIEW 8: REPORTS & CHART WIDGETS */}
        {activeTab === 'reports' && (
          <div className="animate-fadeIn">
            <Reports students={students} />
          </div>
        )}

        {/* SUB VIEW 9: WORKSPACE SETTINGS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn" id="settings_sub_view">
            {/* Digest Settings panel */}
            <div className="bg-white border rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide border-b pb-3">
                Evening digest triggers config
              </h4>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#555a64]">Evening Dispatch Trigger Time:</span>
                <input
                  type="time"
                  className="p-2 border rounded-lg text-xs font-semibold select-none cursor-pointer"
                  value={settings.eveningDigestTime}
                  onChange={(e) => onUpdateSettings({ ...settings, eveningDigestTime: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2.5 mt-2">
                <span className="text-[10px] font-bold text-gray-400">ACTIVE DELIVERY PIPELINES</span>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.deliveryChannels.whatsapp}
                    onChange={(e) => onUpdateSettings({
                      ...settings,
                      deliveryChannels: { whatsapp: e.target.checked }
                    })}
                    className="rounded accent-primary w-4 h-4"
                  />
                  <span className="font-semibold">WhatsApp Delivery Logs Pipeline</span>
                </label>
              </div>
            </div>

            {/* Academic Policy sliders */}
            <div className="bg-white border rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide border-b pb-3">
                Academic thresholds rules
              </h4>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#555a64]">Safe level target threshold percentage:</span>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="60"
                    max="90"
                    value={settings.rules.atRiskThreshold}
                    onChange={(e) => onUpdateSettings({
                      ...settings,
                      rules: { ...settings.rules, atRiskThreshold: parseInt(e.target.value) }
                    })}
                    className="flex-1 accent-primary border cursor-pointer"
                  />
                  <span className="text-sm font-black text-text-primary">{settings.rules.atRiskThreshold}% Target</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 mt-2">
                <span className="text-[10px] font-bold text-gray-400">SUBMISSION LOCK WINDOWS</span>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.rules.strictSubmissionWindow}
                    onChange={(e) => onUpdateSettings({
                      ...settings,
                      rules: { ...settings.rules, strictSubmissionWindow: e.target.checked }
                    })}
                    className="rounded accent-primary w-4 h-4"
                  />
                  <span className="font-semibold">Lock faculty edits 4 hours post class</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                  <input type="checkbox" checked={true} readOnly className="rounded accent-primary w-4 h-4 cursor-not-allowed" />
                  <span className="font-semibold">Only admins can override past data</span>
                </label>
              </div>
            </div>

            {/* System user roles cards */}
            <div className="bg-white border rounded-2xl p-6 shadow-xs flex flex-col gap-3 md:col-span-2">
              <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide border-b pb-3">
                System access roles
              </h4>
              
              <div className="flex flex-col gap-2">
                <div className="p-3 border rounded-xl flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold">SM</div>
                    <div className="flex flex-col">
                      <span className="font-bold">Sarla Mishra</span>
                      <span className="text-[10px] text-gray-400">sarla.m@scholars.com</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200">
                    Super Admin
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Batch Scheduling Config Table */}
            <div className="bg-white border rounded-2xl p-6 shadow-xs flex flex-col gap-4 md:col-span-2">
              <div className="flex flex-col gap-1 border-b pb-3">
                <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide flex items-center gap-1.5 text-primary">
                  <Clock className="w-4 h-4" />
                  COHORT ROTATION CONFIGURATION TABLE
                </h4>
                <p className="text-xs text-[#555a64]">
                  Assign which days each class runs sessions in the live scheduling engine database.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(settings.batchSchedules || []).map(b => (
                  <div key={b.batchId} className="border rounded-xl p-3 bg-slate-50/50 flex flex-col gap-3 justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-xs text-text-primary">{b.batchName}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">ID: {b.batchId}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6].map(dayIndex => {
                        const daysShort = ["", "M", "T", "W", "Th", "F", "Sa"];
                        const dayLabel = daysShort[dayIndex];
                        const isChecked = b.activeDays.includes(dayIndex);

                        const handleLocalToggle = () => {
                          const nextDays = isChecked
                            ? b.activeDays.filter(d => d !== dayIndex)
                            : [...b.activeDays, dayIndex].sort();

                          const updatedList = (settings.batchSchedules || []).map(item => {
                            if (item.batchId === b.batchId) {
                              return { ...item, activeDays: nextDays };
                            }
                            return item;
                          });

                          onUpdateSettings({
                            ...settings,
                            batchSchedules: updatedList
                          });
                        };

                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={handleLocalToggle}
                            className={`w-7 h-7 rounded-md text-[10px] font-black cursor-pointer border flex items-center justify-center transition-all ${
                              isChecked
                                ? "bg-primary text-white border-primary shadow-xs"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                            }`}
                            title={`Toggle ${daysShort[dayIndex]} for ${b.batchName}`}
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
          </div>
        )}

        {/* SUB VIEW 10: DATABASE & SUPABASE WORKSPACE */}
        {false && (
          <div className="flex flex-col gap-6 animate-fadeIn" id="database_workspace_view">
            {/* Upper Interactive Sandbox & Decision Deck */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Left Sandbox Column: Excused Absences Custom Policies */}
              <div className="xl:col-span-5 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-3">
                  <span className="text-[10px] font-black tracking-wider uppercase text-emerald-600 font-display flex items-center gap-1.5 justify-start">
                    <Database className="w-4 h-4 shrink-0 animate-pulse text-emerald-600" />
                    Open Decision Controller
                  </span>
                  <h3 className="text-sm font-bold text-text-primary tracking-tight font-display">
                    EXCUSED ABSENCE FORMULA STANDARDS
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Does an Excused absence count against the 75% threshold? Toggle in real-time to watch calculated stats change instantly across the entire application interface.
                  </p>
                </div>

                {/* Interactive Radio Switches */}
                <div className="flex flex-col gap-3">
                  <div 
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        rules: {
                          ...settings.rules,
                          excusedAbsenceRule: "Excluded"
                        }
                      });
                    }}
                    className={`border rounded-xl p-4 flex items-start gap-3.5 cursor-pointer transition-all ${
                      settings.rules.excusedAbsenceRule === 'Excluded'
                        ? "border-emerald-600 bg-emerald-50/10 ring-1 ring-emerald-600/30"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="excusedRule" 
                      checked={settings.rules.excusedAbsenceRule === 'Excluded'} 
                      onChange={() => {}}
                      className="mt-1 h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-text-primary flex items-center gap-2">
                        Excluded From Denominator 
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-100">Recommended</span>
                      </span>
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        Formal excused leaves (medical, official) do not penalize scores. They are discarded from session totals.
                      </p>
                      <div className="mt-1.5 inline-block font-mono text-[9px] font-bold text-emerald-600 bg-emerald-50/50 p-1 px-2 rounded-md tracking-wider">
                        Formula: Present / (Total Sessions - Excused)
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        rules: {
                          ...settings.rules,
                          excusedAbsenceRule: "CountsAsAbsent"
                        }
                      });
                    }}
                    className={`border rounded-xl p-4 flex items-start gap-3.5 cursor-pointer transition-all ${
                      settings.rules.excusedAbsenceRule === 'CountsAsAbsent'
                        ? "border-[#1e73be] bg-sky-50/10 ring-1 ring-[#1e73be]/30"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="excusedRule" 
                      checked={settings.rules.excusedAbsenceRule === 'CountsAsAbsent'} 
                      onChange={() => {}}
                      className="mt-1 h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-text-primary">
                        Identical to Absent (Counts against 75%)
                      </span>
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        Excused leaves are treated identically to unexcused absences in calculations. Strict discipline policy.
                      </p>
                      <div className="mt-1.5 inline-block font-mono text-[9px] font-bold text-[#1e73be] bg-sky-50/50 p-1 px-2 rounded-md tracking-wider">
                        Formula: Present / Total Sessions
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Sandbox Proof Widget */}
                <div className="bg-[#fafbfd] border border-outline-variant rounded-xl p-4 mt-1 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text-secondary uppercase text-[10px]">Live Simulation feedback:</span>
                    <span className="text-[9px] font-mono text-[#8a909a]">Target Trigger: Arjun Mehta</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-slate-200 bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">A</div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-text-primary">Arjun Mehta</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          (students.find(s => s.id === 'stu_1')?.attendancePercentage || 0) < 75
                            ? "bg-red-50 text-absent-red border border-red-100"
                            : "bg-emerald-50 text-present-green border border-emerald-100"
                        }`}>
                          {(students.find(s => s.id === 'stu_1')?.attendancePercentage || 0) < 75 ? "At Academic Risk" : "Positive Standing"}
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-zinc-400">
                        Roll: 24012 • 26 Present, 14 Absent, <span className="text-amber-600 font-bold">2 Excused</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2 flex justify-between items-center mt-0.5">
                    <span className="text-[10px] text-zinc-500">Evaluated score:</span>
                    <span className="text-xs font-black font-mono text-text-primary">
                      {students.find(s => s.id === 'stu_1')?.attendancePercentage}%
                    </span>
                  </div>
                </div>

              </div>
              
              {/* Right Workspace Column: Workspace Script Hub */}
              <div className="xl:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                
                {/* Horizontal Tab Headers */}
                <div className="flex border-b border-slate-200 overflow-x-auto scroller-hidden">
                  <button 
                    onClick={() => setDatabaseSubTab('schema')}
                    className={`px-4 py-2 text-xs font-bold tracking-tight shrink-0 cursor-pointer border-b-2 transition-all ${
                      databaseSubTab === 'schema'
                        ? "border-emerald-600 text-emerald-700 font-black"
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    1. Core PostgreSQL Schema (8 Tables)
                  </button>
                  <button 
                    onClick={() => setDatabaseSubTab('rls')}
                    className={`px-4 py-2 text-xs font-bold tracking-tight shrink-0 cursor-pointer border-b-2 transition-all ${
                      databaseSubTab === 'rls'
                        ? "border-emerald-600 text-emerald-700 font-black"
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    2. RLS Security Policies
                  </button>
                  <button 
                    onClick={() => setDatabaseSubTab('cron')}
                    className={`px-4 py-2 text-xs font-bold tracking-tight shrink-0 cursor-pointer border-b-2 transition-all ${
                      databaseSubTab === 'cron'
                        ? "border-emerald-600 text-emerald-700 font-black"
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    3. Nightly pg_cron Function
                  </button>
                  <button 
                    onClick={() => setDatabaseSubTab('seed')}
                    className={`px-4 py-2 text-xs font-bold tracking-tight shrink-0 cursor-pointer border-b-2 transition-all ${
                      databaseSubTab === 'seed'
                        ? "border-emerald-600 text-emerald-700 font-black"
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    4. Reference Insert Seedings
                  </button>
                </div>

                {/* SUB-VIEW 1: SCHEMA DESIGNER */}
                {databaseSubTab === 'schema' && (
                  <div className="flex flex-col md:flex-row gap-5 animate-fadeIn">
                    
                    {/* Tables Checklist Sidebar */}
                    <div className="md:w-1/3 flex flex-col gap-1.5 shrink-0">
                      <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Select postgres Table:</span>
                      {Object.keys(schemaTablesData).map(tbl => (
                        <button
                          key={tbl}
                          onClick={() => setSelectedSchemaTable(tbl)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex justify-between items-center transition-all border cursor-pointer ${
                            selectedSchemaTable === tbl
                              ? "bg-slate-900 text-white border-slate-950 shadow-xs"
                              : "bg-slate-50/50 text-text-secondary border-slate-100 hover:bg-slate-100"
                          }`}
                        >
                          <span className="font-mono text-[10px]">{tbl}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                        </button>
                      ))}
                    </div>

                    {/* Columns & DDL display panel */}
                    <div className="flex-1 flex flex-col gap-3.5 min-w-0">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                        <span className="font-black text-xs text-text-primary uppercase tracking-wide font-display block mb-1">
                          Table: <span className="font-mono text-[#1e73be]">{selectedSchemaTable}</span>
                        </span>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                          {schemaTablesData[selectedSchemaTable]?.desc}
                        </p>
                      </div>

                      {/* Column Table */}
                      <div className="border border-outline-variant rounded-xl overflow-hidden bg-white shadow-3xs max-h-[160px] overflow-y-auto w-full animate-fadeIn">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-outline-variant text-[#555a64] font-bold">
                              <th className="p-2 pl-3">Field Name</th>
                              <th className="p-2">Data Type</th>
                              <th className="p-2">Constraints</th>
                              <th className="p-2 pr-3">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schemaTablesData[selectedSchemaTable]?.columns.map(col => (
                              <tr key={col.name} className="border-b border-slate-50 hover:bg-slate-50/25">
                                <td className="p-2 pl-3 font-mono font-bold text-text-primary">{col.name}</td>
                                <td className="p-2 font-mono text-emerald-600">{col.type}</td>
                                <td className="p-2">
                                  {col.key && (
                                    <span className="bg-amber-100 text-[#7b4f00] text-[9px] font-black px-1.5 py-0.5 rounded-md">
                                      {col.key}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 pr-3 text-zinc-500">{col.desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Raw SQL Block */}
                      <div className="relative">
                        <span className="absolute right-3.5 top-3 text-[9px] font-mono text-zinc-500 tracking-wider">POSTGRESQL DDL</span>
                        <pre className="bg-slate-950 text-sky-100 rounded-xl p-4 text-[10px] font-mono overflow-x-auto leading-relaxed max-h-[170px] border border-slate-900 shadow-md">
                          <code>{schemaTablesData[selectedSchemaTable]?.ddl}</code>
                        </pre>
                      </div>

                    </div>
                  </div>
                )}

                {/* SUB-VIEW 2: RLS SECURITY POLICIES */}
                {databaseSubTab === 'rls' && (
                  <div className="flex flex-col gap-3.5 animate-fadeIn">
                    <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3.5 flex gap-3 text-xs leading-normal text-amber-800">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold">Severe Security Notice on Authorization Enforcements</span>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          Row-Level Security (RLS) is executed server-side directly inside Supabase Postgres engine. Client-side application filters are purely cosmetic helper tools. Policies securely restrict read/write authorization bounds bound directly by verified JSON Web Tokens (User Roles).
                        </p>
                      </div>
                    </div>

                    <pre className="bg-slate-950 text-sky-100 rounded-xl p-4 text-[10px] font-mono overflow-x-auto leading-relaxed max-h-[290px] border border-slate-900 shadow-md">
                      <code>{`-- 1. ENABLE ROW LEVEL SECURITY GLOBALLY FOR CORE TRANSITS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance_records ENABLE ROW LEVEL SECURITY;

-- 2. ACADEMIC SUPER ADMIN POLICY (Full CRUD Permissions)
CREATE POLICY admin_full_crud ON public.students
    FOR ALL TO authenticated USING (auth.jwt()->>'role' = 'super_admin');

-- 4. FACULTY ROSTER POLICY (Assigned sessions check restriction)
-- Faculty users can select sessions exclusively explicitly assigned to them
CREATE POLICY faculty_view_assigned_sessions ON public.sessions
    FOR SELECT TO authenticated 
    USING (assigned_faculty_id = auth.uid()::text);

-- Faculty can only create / update student attendance keys within the session assigned to them
CREATE POLICY faculty_manage_attendance_records ON public.student_attendance_records
    FOR ALL TO authenticated
    USING (
         EXISTS (
             SELECT 1 FROM public.sessions 
             WHERE sessions.id = student_attendance_records.session_id 
               AND sessions.assigned_faculty_id = auth.uid()::text
         )
    );`}</code>
                    </pre>
                  </div>
                )}

                {/* SUB-VIEW 3: PG_CRON NIGHTLY COMPILER FUNCTION */}
                {databaseSubTab === 'cron' && (
                  <div className="flex flex-col gap-3.5 animate-fadeIn">
                    <div className="bg-[#fafbfd] border rounded-xl p-3.5">
                      <h4 className="text-xs font-bold text-text-primary mb-1 uppercase tracking-wider font-display flex items-center gap-1.5 text-[#1e73be]">
                        <Clock className="w-4 h-4 text-[#1e73be]" />
                        Nightly Automated Sessions Builder (pg_cron)
                      </h4>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Setting up a PL/pgSQL function to execute precisely at 12:05 AM every single evening via pg_cron. The cron reads the configured core active days inside `batch_schedules`, skips any specified `holidays` exceptions, and generates the exact sessions array for tomorrow seamlessly.
                      </p>
                    </div>

                    <pre className="bg-slate-950 text-sky-100 rounded-xl p-4 text-[10px] font-mono overflow-x-auto leading-relaxed max-h-[270px] border border-slate-900 shadow-md">
                      <code>{`-- Automated PL/pgSQL Daily session generation trigger loop
CREATE OR REPLACE FUNCTION public.generate_daily_sessions_for_date(target_date DATE)
RETURNS VOID AS $$
DECLARE
    day_idx INT;
    has_holiday BOOLEAN;
    is_makeup BOOLEAN;
    holiday_rec RECORD;
BEGIN
    day_idx := extract(dow from target_date);
    
    -- Check for exceptions / holiday closure records
    SELECT EXISTS(SELECT 1 FROM public.holidays WHERE exception_date = target_date AND type = 'holiday') INTO has_holiday;
    SELECT EXISTS(SELECT 1 FROM public.holidays WHERE exception_date = target_date AND type = 'makeup') INTO is_makeup;
    
    IF has_holiday THEN
        RETURN; -- Closed day: discard any compilation
    END IF;

    -- Generating Consolidated classes on Makeup Days overrides
    IF is_makeup THEN
        SELECT * FROM public.holidays WHERE exception_date = target_date INTO holiday_rec;
        INSERT INTO public.sessions (batch_id, subject, session_time, room_no, status, scheduled_date)
        SELECT b.batch_id, 'Makeup Lectures: ' || holiday_rec.event_name, '10:00 AM', 'Consolidated Hall', 'Pending', target_date
        FROM public.batch_schedules b;
        RETURN;
    END IF;

    IF day_idx = 0 THEN RETURN; -- Skip Sunday Recess
    END IF;

    -- Compile Standard Batches active on tomorrow's index
    INSERT INTO public.sessions (batch_id, subject, session_time, room_no, status, scheduled_date)
    SELECT 
        b.batch_id,
        CASE WHEN b.batch_id LIKE '%jee' THEN 'Advanced Physics' ELSE 'Applied Zoology' END,
        '09:00 AM',
        'Academic Block A',
        'Pending',
        target_date
    FROM public.batch_schedules b
    WHERE day_idx = ANY(b.active_days);
END;
$$ LANGUAGE plpgsql;

-- Schedule job execution dynamically
SELECT cron.schedule('generate-sessions-cron', '5 0 * * *', 'SELECT public.generate_daily_sessions_for_date((CURRENT_DATE + INTERVAL ''1 day'')::date)');`}</code>
                    </pre>
                  </div>
                )}

                {/* SUB-VIEW 4: EXAMPLES INSERT DATA SEEDINGS */}
                {databaseSubTab === 'seed' && (
                  <div className="flex flex-col gap-3.5 animate-fadeIn">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                      <span className="font-bold text-xs text-text-primary block mb-1">Initialize Database Reference Arrays</span>
                      <p className="text-[11px] text-zinc-500 leading-normal">
                        SQL Script to pre-populate database structures with custom initial batches, subjects, and instructor rosters to allow fast first-day launch standings.
                      </p>
                    </div>

                    <pre className="bg-slate-950 text-sky-100 rounded-xl p-4 text-[10px] font-mono overflow-x-auto leading-relaxed max-h-[290px] border border-slate-900 shadow-md">
                      <code>{`-- 1. POPULATE INITIAL ACTIVE BATCHES WEEK RULES
INSERT INTO public.batch_schedules (batch_id, batch_name, batch_tag, active_days) VALUES
('batch_11_jee', 'Pinnacle Class-11 JEE', 'Class 11-A', '{1,3,5}'),
('batch_12_neet', 'Supreme Class-12 NEET', 'Class 12-C', '{2,4,6}'),
('batch_12_jee', 'Zenith Class-12 JEE', 'Class 12-A', '{2,4,6}'),
('batch_11_neet', 'Apex Class-11 NEET', 'Class 11-C', '{1,3,5}'),
('batch_10_ntse', 'Elite Class-10 NTSE', 'Class 10-D', '{1,3,5}');

-- 2. POPULATE INITIAL REFERENCE INSTRUCTOR ACCOUNTS
INSERT INTO public.faculty (id, name, title, subjects, batches, status) VALUES
('fac_1', 'Dr. Rajesh Kumar', 'Senior Physics HOD', '{"Physics"}', '{"Pinnacle Class-11 JEE", "Supreme Class-12 NEET", "Zenith Class-12 JEE"}', 'Active'),
('fac_2', 'Ms. Ananya Sharma', 'Senior Chemistry Faculty', '{"Chemistry"}', '{"Pinnacle Class-11 JEE", "Supreme Class-12 NEET", "Apex Class-11 NEET"}', 'Active'),
('fac_3', 'Dr. Preeti Sen', 'Biology Senior Advisor', '{"Biology"}', '{"Supreme Class-12 NEET", "Apex Class-11 NEET", "Elite Class-10 NTSE"}', 'Active');

-- 3. LOAD INITIAL ACADEMIC EXCEPTIONS
INSERT INTO public.holidays (exception_date, event_name, type, notes) VALUES
('2026-08-15', 'Independence Day Vacation', 'holiday', 'National Closure - Skip all normal batch timetables'),
('2026-10-23', 'National Science Fest Prep', 'makeup', 'Unified Makeup Lectures Program');`}</code>
                    </pre>
                  </div>
                )}

              </div>
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
