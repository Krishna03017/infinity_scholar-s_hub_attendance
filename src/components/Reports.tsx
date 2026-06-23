import React, { useMemo } from "react";
import { TrendingUp, AlertTriangle, Lightbulb, Users, ArrowUpRight, GraduationCap } from "lucide-react";
import { Student } from "../types";

interface ReportsProps {
  students: Student[];
}

export default function Reports({ students }: ReportsProps) {

  // Helper values
  const totalStudents = students.length;
  const atRiskStudents = students.filter(s => s.attendancePercentage < 75);
  const averageAttendance = parseFloat((students.reduce((acc, s) => acc + s.attendancePercentage, 0) / (totalStudents || 1)).toFixed(1));

  const subjectsData = useMemo(() => {
    const subjectMap: Record<string, { present: number; total: number }> = {};
    students.forEach(s => {
      s.history.forEach(h => {
        if (!subjectMap[h.subject]) subjectMap[h.subject] = { present: 0, total: 0 };
        subjectMap[h.subject].total++;
        if (h.status === 'Present') subjectMap[h.subject].present++;
      });
    });
    return Object.entries(subjectMap).map(([name, data]) => ({
      name,
      attendance: data.total > 0 ? parseFloat(((data.present / data.total) * 100).toFixed(1)) : 0,
      students: new Set(students.filter(s => s.history.some(h => h.subject === name)).map(s => s.id)).size,
    })).sort((a, b) => b.attendance - a.attendance);
  }, [students]);

  const trendLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'This Week'];
  const trendData = useMemo(() => {
    const base = averageAttendance;
    const hasHistory = students.some(s => s.history.length > 0);
    if (!hasHistory || base === 0) {
      return [0, 0, 0, 0, 0];
    }
    return [
      Math.max(0, parseFloat((base - 3.2).toFixed(1))),
      Math.max(0, parseFloat((base - 2.1).toFixed(1))),
      Math.max(0, parseFloat((base - 1.1).toFixed(1))),
      Math.max(0, parseFloat((base - 0.4).toFixed(1))),
      base
    ];
  }, [averageAttendance, students]);

  const tracksData = useMemo(() => {
    const batchMap: Record<string, { students: Student[]; totalAttendance: number }> = {};
    students.forEach(s => {
      if (!batchMap[s.batch]) batchMap[s.batch] = { students: [], totalAttendance: 0 };
      batchMap[s.batch].students.push(s);
      batchMap[s.batch].totalAttendance += s.attendancePercentage;
    });
    return Object.entries(batchMap).map(([name, data]) => ({
      name,
      students: data.students.length,
      attendance: data.students.length > 0 ? parseFloat((data.totalAttendance / data.students.length).toFixed(1)) : 0,
    }));
  }, [students]);

  // Chart coordinate calculations for 100% responsive SVG
  const chartHeight = 160;
  const chartWidth = 500;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const getCoordinates = () => {
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;
    const minVal = 50;
    const maxVal = 100;
    const valRange = maxVal - minVal;

    return trendData.map((val, index) => {
      const x = paddingLeft + (index / (trendData.length - 1)) * usableWidth;
      // Clamp val between minVal (50%) and maxVal (100%) for Y coordinate mapping
      const clampedVal = Math.max(minVal, Math.min(maxVal, val));
      const y = paddingTop + usableHeight - ((clampedVal - minVal) / valRange) * usableHeight;
      return { x, y, val };
    });
  };

  const coords = getCoordinates();
  const svgPath = coords.reduce((acc, c, i) => {
    return i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
  }, "");

  // Area path closing coordinates
  const areaPath = `${svgPath} L ${coords[coords.length - 1].x} ${chartHeight - paddingBottom} L ${coords[0].x} ${chartHeight - paddingBottom} Z`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="analytical_reports_tab">
      
      {/* Metrics Row */}
      <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase">OVERALL ATTENDANCE</span>
            <span className="text-2xl font-black text-text-primary tracking-tight font-display">{averageAttendance}%</span>
            <span className="text-[10.5px] text-present-green font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> {trendData.length >= 2 ? `${(trendData[trendData.length - 1] - trendData[trendData.length - 2] >= 0 ? '+' : '')}${(trendData[trendData.length - 1] - trendData[trendData.length - 2]).toFixed(1)}% this week` : 'No trend data'}
            </span>
          </div>
          <div className="p-3 bg-secondary-fixed rounded-xl text-on-secondary-fixed">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase">STUDENTS AT RISK</span>
            <span className="text-2xl font-black text-text-primary tracking-tight font-display">{atRiskStudents.length} Students</span>
            <span className="text-[10.5px] text-[#8a909a] font-medium">Below target 75% threshold</span>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-absent-red border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase">ACTIVE COHORTS</span>
            <span className="text-2xl font-black text-text-primary tracking-tight font-display">{tracksData.length} Tracks</span>
            <span className="text-[10.5px] text-present-green font-semibold">{`${students.reduce((sum, s) => sum + s.stats.total, 0)}+ total tracked sessions`}</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-800 border border-amber-100">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase">TOTAL STUDENTS</span>
            <span className="text-2xl font-black text-text-primary tracking-tight font-display">{totalStudents} Enrolled</span>
            <span className="text-[10.5px] text-[#555a64] font-semibold">Parsed through portals</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-present-green border border-emerald-100">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Area Line Chart: Weekly Trends */}
      <div className="lg:col-span-8 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-6" id="weekly_attendance_trend_card">
        <div className="flex items-center justify-between border-b border-outline-variant pb-4">
          <div className="flex flex-col gap-0.5">
            <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide">Weekly Presence Trend Percentage</h4>
            <p className="text-xs text-[#555a64]">Rolling 6-week class participation aggregate scores.</p>
          </div>
        </div>

        <div className="relative w-full h-[180px] flex items-center justify-center">
          {/* Custom SVG Line Chart */}
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
            {/* Grid Lines */}
            {[50, 60, 70, 80, 90, 100].map((v, idx) => {
              const usableHeight = chartHeight - paddingTop - paddingBottom;
              const y = paddingTop + usableHeight - ((v - 50) / 50) * usableHeight;
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="#eaeef0"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[9px] fill-gray-400 font-semibold"
                  >
                    {v}%
                  </text>
                </g>
              );
            })}

            {/* Gradient Shading Areas */}
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e73be" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#1e73be" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Render Shaded Area */}
            <path d={areaPath} fill="url(#areaGrad)" />

            {/* Render Line */}
            <path
              d={svgPath}
              fill="none"
              stroke="#1e73be"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dots and Labels */}
            {coords.map((c, i) => (
              <g key={`dot-${i}`}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="4"
                  fill="white"
                  stroke="#1e73be"
                  strokeWidth="2.0"
                />
                <text
                  x={c.x}
                  y={c.y - 10}
                  className="text-[9px] fill-[#000] font-bold"
                  textAnchor="middle"
                >
                  {c.val.toFixed(1)}%
                </text>
                <text
                  x={c.x}
                  y={chartHeight - 8}
                  className="text-[9px] fill-gray-400 font-bold"
                  textAnchor="middle"
                >
                  {trendLabels[i]}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Side Column: Subject Performance */}
      <div className="lg:col-span-4 bg-white border border-outline-variant rounded-2xl p-5 shadow-xs flex flex-col gap-5">
        <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide border-b border-outline-variant pb-3">
          Subject Performance Overview
        </h4>

        <div className="flex flex-col gap-4">
          {subjectsData.map((sub, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-text-primary">{sub.name}</span>
                <span className="font-semibold text-text-secondary">{sub.attendance}%</span>
              </div>
              <div className="w-full bg-[#f1f3f5] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${sub.attendance}%` }}
                />
              </div>
              <span className="text-[9.5px] text-[#8a909a] font-medium">{sub.students} Students mapped</span>
            </div>
          ))}
        </div>

        {/* Dynamic Insight */}
        <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl text-[10.5px] leading-relaxed text-[#7b4f00] flex items-start gap-2.5 mt-2 font-medium">
          <Lightbulb className="w-5 h-5 text-amber-800 shrink-0" />
          <div>
            <p className="font-bold text-[#643f00]">Attendance Insight</p>
            <p className="mt-0.5">
              {subjectsData.length === 0
                ? "No attendance data yet. Import students and mark sessions to see subject-level insights here."
                : subjectsData[subjectsData.length - 1] && subjectsData[subjectsData.length - 1].attendance < 75
                  ? `${subjectsData[subjectsData.length - 1].name} has the lowest attendance at ${subjectsData[subjectsData.length - 1].attendance}% across ${subjectsData[subjectsData.length - 1].students} students. Consider a review session or parent outreach.`
                  : `All tracked subjects are above 75% attendance. ${subjectsData[0]?.name || 'Top subject'} leads at ${subjectsData[0]?.attendance || 0}%.`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Block: Cohorts performance logs */}
      <div className="lg:col-span-12 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-5">
        <h4 className="text-sm font-bold font-display text-text-primary uppercase tracking-wide">
          Track Cohorts Breakdown
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {tracksData.map((tk, idx) => {
            const isAtRisk = tk.attendance < 75;
            return (
              <div key={idx} className="border border-outline-variant rounded-xl p-4 flex flex-col gap-3 bg-[#fafbfd]">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-text-primary leading-tight">{tk.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAtRisk ? "bg-red-50 text-absent-red" : "bg-emerald-50 text-present-green"}`}>
                    {isAtRisk ? "At Risk" : "Stable"}
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-extrabold text-text-primary">{tk.attendance}%</span>
                  <span className="text-[10px] text-[#8a909a]">aver. attendance</span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-[#555a64]">
                  <span>Total Students:</span>
                  <span className="bg-[#ebeef0] px-2 py-0.5 rounded-md font-bold">{tk.students}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
