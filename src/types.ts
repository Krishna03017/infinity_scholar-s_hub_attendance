export type AttendanceStatus = 'Present' | 'Absent' | 'Excused';

export interface StudentAttendanceRecord {
  id: string;
  date: string;
  time: string;
  subject: string;
  status: AttendanceStatus;
  markedBy: string;
}

export interface StudentStats {
  total: number;
  present: number;
  absent: number;
  excused: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  parentPhone: string;
  parentName: string;
  batch: string; // e.g. "Pinnacle Class-11 JEE"
  batchId: string;
  targetThreshold: number; // e.g. 75
  attendancePercentage: number;
  status: 'Active' | 'Suspended';
  stats: StudentStats;
  history: StudentAttendanceRecord[];
}

export interface Faculty {
  id: string;
  name: string;
  title: string;
  phone: string;       // contact number stored for admin reference
  subjects: string[]; // subjects this teacher is authorised to mark attendance for
  submissionRate: number; // e.g. 94%
  status: 'Active' | 'On Leave';
}

export interface Session {
  id: string;
  batchName: string;
  batchTag: string; // e.g. "Class 11-A"
  batchId: string;
  subject: string;
  time: string;
  room: string;
  studentsCount: number;
  status: 'Marked' | 'Pending' | 'Upcoming' | 'Cancelled' | 'Makeup';
  assignedFaculty: string;
  markedBy?: string;
  presentCount?: number;
  absentCount?: number;
}

export interface TimeSlotRecord {
  subject: string;
  room: string;
  faculty: string;
  status?: 'CANCELLED' | 'MAKEUP' | 'REGULAR';
}

export interface TimetableRow {
  slotId: string;
  time: string;
  monday?: TimeSlotRecord;
  tuesday?: TimeSlotRecord;
  wednesday?: TimeSlotRecord;
}

export interface NotificationLog {
  id: string;
  recipient: string;
  channel: 'whatsapp';
  status: 'Delivered' | 'Failed' | 'Pending';
  message: string;
  timestamp: string;
}

export interface HolidayEvent {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'holiday' | 'makeup' | 'meeting';
  notes?: string;
}

export interface BroadcastTemplate {
  id: string;
  title: string;
  message: string;
}

export interface BatchSchedule {
  batchId: string;
  batchName: string;
  batchTag: string;
  activeDays: number[]; // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
}

export interface SettingsConfig {
  eveningDigestTime: string; // e.g., "19:00"
  deliveryChannels: {
    whatsapp: boolean;
  };
  templates: {
    absentEnglish: string;
    absentHindi: string;
    weeklyProgress: string;
  };
  rules: {
    atRiskThreshold: number; // e.g., 75
    strictSubmissionWindow: boolean;
    submissionHourLimit: number;
    excusedAbsenceRule: 'Excluded' | 'CountsAsAbsent';
  };
  scheduling: {
    oddEvenDayRotation: string; // 'Standard' | 'Alternate'
    jeeNeetConflictResolution: string; // 'Priority' | 'Separate'
  };
  batchSchedules: BatchSchedule[];
}

export interface AppState {
  currentRole: 'admin' | 'faculty';
  students: Student[];
  faculty: Faculty[];
  sessions: Session[];
  timetable: TimetableRow[];
  notificationLogs: NotificationLog[];
  holidays: HolidayEvent[];
  templates: BroadcastTemplate[];
  settings: SettingsConfig;
}
