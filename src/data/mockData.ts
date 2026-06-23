import { Student, Faculty, Session, TimetableRow, NotificationLog, HolidayEvent, BroadcastTemplate, SettingsConfig } from "../types";

export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_FACULTY: Faculty[] = [];
export const INITIAL_SESSIONS: Session[] = [];
export const INITIAL_TIMETABLE: TimetableRow[] = [];
export const INITIAL_NOTIFICATION_LOGS: NotificationLog[] = [];
export const INITIAL_HOLIDAYS: HolidayEvent[] = [];

export const INITIAL_TEMPLATES: BroadcastTemplate[] = [
  {
    id: "tmpl_absent_en",
    title: "Absent Alert (English)",
    message: "Dear parent, {{student_name}} was ABSENT from {{batch_name}} {{subject}} session scheduled today. Your ward's current attendance is {{attendance_rate}}%. Please contact us to discuss. Regards, Management."
  },
  {
    id: "tmpl_absent_hi",
    title: "Absent Alert (Hindi)",
    message: "प्रिय अभिभावक, {{student_name}} आज {{batch_name}} {{subject}} की कक्षा में अनुपस्थित रहे। उनकी वर्तमान उपस्थिति {{attendance_rate}}% है। कृपया हमसे संपर्क करें। - प्रबंधन"
  },
  {
    id: "tmpl_weekly",
    title: "Weekly Progress Report",
    message: "Dear parent, here is {{student_name}}'s weekly attendance update for {{batch_name}}. Total sessions: {{total_count}}, Present: {{present_count}}, Attendance: {{percentage}}%. Keep encouraging regular attendance!"
  }
];

export const INITIAL_SETTINGS: SettingsConfig = {
  eveningDigestTime: "19:00",
  deliveryChannels: {
    whatsapp: false
  },
  templates: {
    absentEnglish: "Dear parent, {{student_name}} was ABSENT from {{batch_name}} {{subject}} session scheduled today. Your ward's current attendance is {{attendance_rate}}%. Please contact us to discuss. Regards, Management.",
    absentHindi: "प्रिय अभिभावक, {{student_name}} आज {{batch_name}} {{subject}} की कक्षा में अनुपस्थित रहे। उनकी वर्तमान उपस्थिति {{attendance_rate}}% है। कृपया हमसे संपर्क करें। - प्रबंधन",
    weeklyProgress: "Dear parent, here is {{student_name}}'s weekly attendance update for {{batch_name}}. Total sessions: {{total_count}}, Present: {{present_count}}, Attendance: {{percentage}}%. Keep encouraging regular attendance!"
  },
  rules: {
    atRiskThreshold: 75,
    strictSubmissionWindow: true,
    submissionHourLimit: 4,
    excusedAbsenceRule: "Excluded"
  },
  scheduling: {
    oddEvenDayRotation: "Alternate",
    jeeNeetConflictResolution: "Priority"
  },
  batchSchedules: []
};
