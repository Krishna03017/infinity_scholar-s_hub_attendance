/**
 * CSV/Data export utilities for Infinity Scholar's Hub.
 * Generates downloadable CSV files from application data.
 */

import { Student, NotificationLog } from '../types';

/**
 * Trigger a browser file download with the given content.
 */
function downloadFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape a CSV field value — wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export all student data as a CSV file.
 */
export function exportStudentsCSV(students: Student[]): void {
  const headers = [
    'Name', 'Email', 'Batch', 'Batch ID',
    'Parent Name', 'Parent Phone', 'Status',
    'Attendance %', 'Total Sessions', 'Present', 'Absent', 'Excused',
    'Target Threshold'
  ];

  const rows = students.map(s => [
    escapeCSV(s.name),
    escapeCSV(s.email),
    escapeCSV(s.batch),
    escapeCSV(s.batchId),
    escapeCSV(s.parentName),
    escapeCSV(s.parentPhone),
    escapeCSV(s.status),
    s.attendancePercentage,
    s.stats.total,
    s.stats.present,
    s.stats.absent,
    s.stats.excused,
    s.targetThreshold
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadFile(`students_export_${date}.csv`, csv);
}

/**
 * Export attendance summary report as CSV.
 */
export function exportAttendanceReport(students: Student[]): void {
  const headers = [
    'Name', 'Batch', 'Attendance %',
    'Present', 'Absent', 'Excused', 'Total',
    'Risk Status'
  ];

  const rows = students.map(s => [
    escapeCSV(s.name),
    escapeCSV(s.batch),
    s.attendancePercentage,
    s.stats.present,
    s.stats.absent,
    s.stats.excused,
    s.stats.total,
    escapeCSV(s.attendancePercentage < 75 ? 'At Risk' : 'Safe')
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadFile(`attendance_report_${date}.csv`, csv);
}

/**
 * Export notification logs as CSV.
 */
export function exportNotificationLogs(logs: NotificationLog[]): void {
  const headers = ['Recipient', 'Channel', 'Status', 'Message', 'Timestamp'];

  const rows = logs.map(l => [
    escapeCSV(l.recipient),
    escapeCSV(l.channel),
    escapeCSV(l.status),
    escapeCSV(l.message),
    escapeCSV(l.timestamp)
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadFile(`notification_logs_${date}.csv`, csv);
}
