import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { Student } from "../types";

interface CSVImporterProps {
  onImport: (newStudents: Student[]) => void;
  existingBatches: string[];
}

export default function CSVImporter({ onImport, existingBatches }: CSVImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSVText = (text: string) => {
    setError(null);
    setStatus(null);
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.data.length === 0) {
            throw new Error("CSV file should contain at least one student record.");
          }

          const parsedStudents: Student[] = [];

          results.data.forEach((rowObj: any, i) => {
            const getField = (keys: string[], defaultVal = ""): string => {
              for (const key of keys) {
                const foundKey = Object.keys(rowObj).find(k => k.trim().toLowerCase() === key.toLowerCase());
                if (foundKey && rowObj[foundKey] !== undefined) {
                  return String(rowObj[foundKey]).trim();
                }
              }
              return defaultVal;
            };

            const name = getField(["name", "studentname", "student name"], `Student ${i + 1}`);
            const email = getField(["email", "emailid", "email id", "email address"]);
            const parentName = getField(["parentname", "parent name", "fathername", "mothername"], "");
            const parentPhone = getField(["parentphone", "parent phone", "parentcontact", "phone", "contact"], "");
            const rawBatch = getField(["batch", "batchname", "class", "cohort"], "");
            const rawAtt = getField(["attendancepercentage", "attendance percentage", "attendance", "attendance %"], "100");

            const finalId = `stu_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
            const sanitizedAtt = parseFloat(rawAtt.replace(/%/g, '').trim());
            const attendance = isNaN(sanitizedAtt) ? 100 : Math.max(0, Math.min(100, sanitizedAtt));

            const batchId = rawBatch
              ? "batch_" + rawBatch.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
              : "batch_default";

            parsedStudents.push({
              id: finalId,
              name,
              email,
              parentName,
              parentPhone,
              batch: rawBatch,
              batchId,
              targetThreshold: 75,
              attendancePercentage: parseFloat(attendance.toFixed(1)),
              status: "Active",
              stats: {
                total: 0,
                present: 0,
                absent: 0,
                excused: 0
              },
              history: []
            });
          });

          if (parsedStudents.length === 0) {
            throw new Error("Could not parse any valid student rows.");
          }

          onImport(parsedStudents);
          setStatus({
            type: "success",
            message: `Successfully imported ${parsedStudents.length} student${parsedStudents.length !== 1 ? 's' : ''}.`
          });
        } catch (err: any) {
          setError(err.message || "Failed to parse CSV records.");
        }
      },
      error: (err) => {
        setError("Failed parsing CSV file: " + err.message);
      }
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please drop/select a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        parseCSVText(text);
      }
    };
    reader.onerror = () => {
      setError("Error reading your CSV file. Try copying the raw text instead.");
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-outline-variant p-6 shadow-xs flex flex-col gap-6" id="csv_importer_card">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold font-display text-text-primary flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Bulk CSV Import
        </h3>
        <p className="text-xs text-[#555a64]">
          Upload a CSV file or paste raw CSV data to import multiple students at once.
        </p>
      </div>

      {/* Column format guide */}
      <div className="bg-slate-50 border border-outline-variant rounded-xl p-3 text-[10.5px] text-gray-500 font-medium leading-relaxed">
        <span className="font-bold text-gray-700 block mb-1">Expected columns (headers, any order):</span>
        <span className="font-mono text-primary">Name</span> &nbsp;·&nbsp;
        <span className="font-mono text-primary">Email</span> &nbsp;·&nbsp;
        <span className="font-mono text-primary">ParentName</span> &nbsp;·&nbsp;
        <span className="font-mono text-primary">ParentPhone</span> &nbsp;·&nbsp;
        <span className="font-mono text-primary">Batch</span> &nbsp;·&nbsp;
        <span className="font-mono text-primary">AttendancePercentage</span>
        <span className="block mt-1 text-gray-400">All fields except Name are optional.</span>
      </div>

      {/* Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px] transition-all duration-200 ${
          dragActive
            ? "border-primary bg-[rgba(30,115,190,0.06)]"
            : "border-outline-variant hover:border-primary bg-[#fcfdfe]"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        id="csv_drag_drop_zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
        
        <div className="p-3 bg-secondary-fixed rounded-full text-on-secondary-fixed flex items-center justify-center mb-3">
          <Upload className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-text-primary">
          Drag and drop your <span className="font-mono">.csv</span> file here, or <span className="text-primary underline">browse files</span>
        </p>
        <p className="text-xs text-[#6e7480] mt-1">
          Only .csv files supported. Max recommended: 5,000 rows.
        </p>
      </div>

      {/* Paste fallback */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowManual(!showManual)}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 w-fit"
          type="button"
        >
          {showManual ? "Hide paste zone" : "Or paste raw CSV text..."}
        </button>

        {showManual && (
          <div className="flex flex-col gap-3 mt-1">
            <textarea
              className="w-full h-32 p-3 font-mono text-xs border border-outline-variant rounded-lg bg-[#fafbfd] focus:outline-primary placeholder-[#9ea1aa]"
              placeholder={"Name,Email,ParentName,ParentPhone,Batch,AttendancePercentage\nStudent Name,email@example.com,Parent Name,9999900000,Batch Name,85.0"}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            <button
              onClick={() => parseCSVText(textInput)}
              disabled={!textInput.trim()}
              className="w-full text-xs font-bold py-2 bg-primary text-white hover:bg-primary-container rounded-lg disabled:opacity-50 transition-colors"
            >
              Import Pasted Data
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {status && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-present-green flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">Import Successful</p>
            <p className="text-emerald-700 font-medium mt-0.5">{status.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200/80 rounded-xl text-xs text-absent-red flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Import Error</p>
            <p className="text-red-700 font-medium mt-0.5">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
