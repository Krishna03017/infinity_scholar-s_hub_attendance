import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getDB, resetDatabase } from "./src/services/database.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "super-secure-jwt-key-for-development";

app.use(express.json({ limit: "50mb" }));

// Helper utility to convert database snake_case keys to camelCase for the frontend
const toCamel = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(toCamel);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = toCamel(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

// Store active OTPs in memory: { cleanPhone: { otp, expires } }
const activeOtps: Record<string, { otp: string; expires: number }> = {};

// JWT Authentication Middleware
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: "admin" | "faculty";
  };
}

const authenticateJWT = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization token missing" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Zod Validation Schemas
const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

const RequestOtpSchema = z.object({
  phone: z.string().min(1, "Phone number is required")
});

const VerifyOtpSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  otp: z.string().length(6, "OTP must be exactly 6 digits")
});

const StudentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  parentPhone: z.string().min(1),
  parentName: z.string().min(1),
  batch: z.string().min(1),
  batchId: z.string().min(1),
  targetThreshold: z.number().default(75),
  attendancePercentage: z.number().default(100),
  status: z.enum(["Active", "Suspended"]).default("Active"),
  stats: z.object({
    total: z.number(),
    present: z.number(),
    absent: z.number(),
    excused: z.number()
  }),
  history: z.array(z.object({
    id: z.string(),
    date: z.string(),
    time: z.string(),
    subject: z.string(),
    status: z.enum(["Present", "Absent", "Excused"]),
    markedBy: z.string()
  }))
});

const SettingsSchema = z.object({
  eveningDigestTime: z.string(),
  deliveryChannels: z.object({
    whatsapp: z.boolean()
  }),
  templates: z.object({
    absentEnglish: z.string(),
    absentHindi: z.string(),
    weeklyProgress: z.string()
  }),
  rules: z.object({
    atRiskThreshold: z.number(),
    strictSubmissionWindow: z.boolean(),
    submissionHourLimit: z.number(),
    excusedAbsenceRule: z.enum(["Excluded", "CountsAsAbsent"])
  }),
  scheduling: z.object({
    oddEvenDayRotation: z.string(),
    jeeNeetConflictResolution: z.string()
  }),
  batchSchedules: z.array(z.object({
    batchId: z.string(),
    batchName: z.string(),
    batchTag: z.string(),
    activeDays: z.array(z.number())
  }))
});

// API Routes

// Health check API
app.get("/api/health", async (req, res) => {
  try {
    const db = await getDB();
    await db.get("SELECT 1"); // Verify connection is active
    
    res.json({
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  } catch (err: any) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: err.message
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);
    const db = await getDB();
    
    const user = await db.get("SELECT * FROM users WHERE LOWER(username) = ?", [username.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Verify bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, displayName: user.display_name, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      user: { displayName: user.display_name, role: user.role },
      token
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0].message });
    }
    res.status(500).json({ message: "Authentication error. Please try again." });
  }
});

// OTP login for faculty — queries faculty table (admin-managed records) by phone number
app.post("/api/auth/request-otp", async (req, res) => {
  try {
    const { phone } = RequestOtpSchema.parse(req.body);
    const db = await getDB();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const faculty = await db.get(
      "SELECT * FROM faculty WHERE phone LIKE ?",
      [`%${cleanPhone}`]
    );
    if (!faculty) {
      return res.status(404).json({ message: "This phone number is not registered. Ask your admin to add you as faculty." });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    activeOtps[cleanPhone] = { otp, expires: Date.now() + 5 * 60 * 1000 };
    console.log(`[SMS Gateway] OTP for ${faculty.name} (+91${cleanPhone}): ${otp}`);
    const isProduction = process.env.NODE_ENV === "production";
    res.json({
      success: true,
      message: "OTP sent to your registered number",
      mockOtp: isProduction ? undefined : otp
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0].message });
    }
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = VerifyOtpSchema.parse(req.body);
    const db = await getDB();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const record = activeOtps[cleanPhone];
    if (!record) {
      return res.status(400).json({ message: "No active OTP found. Please request a new one." });
    }
    if (Date.now() > record.expires) {
      delete activeOtps[cleanPhone];
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }
    if (record.otp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }
    delete activeOtps[cleanPhone];
    const faculty = await db.get(
      "SELECT * FROM faculty WHERE phone LIKE ?",
      [`%${cleanPhone}`]
    );
    if (!faculty) {
      return res.status(404).json({ message: "Faculty record not found." });
    }
    const token = jwt.sign(
      { id: faculty.id, username: faculty.id, displayName: faculty.name, role: "faculty" },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({
      user: { displayName: faculty.name, role: "faculty" },
      token
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0].message });
    }
    res.status(500).json({ message: "OTP verification failed" });
  }
});

app.get("/api/students", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM students");
    const parsed = rows.map(r => ({
      ...r,
      stats: JSON.parse(r.stats),
      history: JSON.parse(r.history)
    }));
    res.json(toCamel(parsed));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/students", authenticateJWT, async (req, res) => {
  try {
    const student = StudentSchema.parse(req.body);
    const db = await getDB();
    
    await db.run(
      "INSERT INTO students (id, name, email, parent_phone, parent_name, batch, batch_id, target_threshold, attendance_percentage, status, stats, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        student.id,
        student.name,
        student.email || null,
        student.parentPhone,
        student.parentName,
        student.batch,
        student.batchId,
        student.targetThreshold,
        student.attendancePercentage,
        student.status,
        JSON.stringify(student.stats),
        JSON.stringify(student.history)
      ]
    );
    res.status(201).json(student);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0].message });
    }
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/students", authenticateJWT, async (req, res) => {
  try {
    const updatedStudents = z.array(StudentSchema).parse(req.body);
    const db = await getDB();
    
    // SQLite transaction bulk update
    await db.run("BEGIN TRANSACTION;");
    try {
      // Clear existing students
      await db.run("DELETE FROM students;");
      for (const s of updatedStudents) {
        await db.run(
          "INSERT INTO students (id, name, email, parent_phone, parent_name, batch, batch_id, target_threshold, attendance_percentage, status, stats, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            s.id,
            s.name,
            s.email || null,
            s.parentPhone,
            s.parentName,
            s.batch,
            s.batchId,
            s.targetThreshold,
            s.attendancePercentage,
            s.status,
            JSON.stringify(s.stats),
            JSON.stringify(s.history)
          ]
        );
      }
      await db.run("COMMIT;");
      res.json(updatedStudents);
    } catch (txErr) {
      await db.run("ROLLBACK;");
      throw txErr;
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0].message });
    }
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/faculty", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM faculty");
    const parsed = rows.map(r => ({
      ...r,
      subjects: JSON.parse(r.subjects || '[]'),
      phone: r.phone || '',
      submission_rate: r.submission_rate ?? 100
    }));
    res.json(toCamel(parsed));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/faculty", authenticateJWT, async (req, res) => {
  try {
    const f = req.body;
    if (!f || !f.id || !f.name) {
      return res.status(400).json({ message: "Faculty id and name are required" });
    }
    const db = await getDB();
    await db.run(
      "INSERT INTO faculty (id, name, title, phone, subjects, submission_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [f.id, f.name, f.title || "", f.phone || "", JSON.stringify(f.subjects || []), f.submissionRate ?? 100, f.status || "Active"]
    );
    res.status(201).json(f);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/faculty/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (!updates) return res.status(400).json({ message: "No update data provided" });
    const db = await getDB();
    await db.run(
      "UPDATE faculty SET subjects = ?, title = ?, phone = ?, status = ? WHERE id = ?",
      [
        JSON.stringify(updates.subjects || []),
        updates.title || "",
        updates.phone || "",
        updates.status || "Active",
        id
      ]
    );
    const updated = await db.get("SELECT * FROM faculty WHERE id = ?", [id]);
    if (!updated) return res.status(404).json({ message: "Faculty not found" });
    res.json(toCamel({ ...updated, subjects: JSON.parse(updated.subjects || '[]'), phone: updated.phone || '' }));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/faculty/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    const existing = await db.get("SELECT id FROM faculty WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ message: "Faculty not found" });
    await db.run("DELETE FROM faculty WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM sessions");
    res.json(toCamel(rows));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/sessions", authenticateJWT, async (req, res) => {
  try {
    const updatedSessions = req.body;
    if (!Array.isArray(updatedSessions)) {
      return res.status(400).json({ message: "Expected array of sessions" });
    }
    const db = await getDB();
    
    await db.run("BEGIN TRANSACTION;");
    try {
      await db.run("DELETE FROM sessions;");
      for (const s of updatedSessions) {
        await db.run(
          "INSERT INTO sessions (id, batch_name, batch_tag, batch_id, subject, time, room, students_count, status, assigned_faculty, marked_by, present_count, absent_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            s.id,
            s.batchName,
            s.batchTag,
            s.batchId,
            s.subject,
            s.time,
            s.room,
            s.studentsCount,
            s.status,
            s.assignedFaculty,
            s.markedBy || null,
            s.presentCount || null,
            s.absentCount || null
          ]
        );
      }
      await db.run("COMMIT;");
      res.json(updatedSessions);
    } catch (txErr) {
      await db.run("ROLLBACK;");
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/notificationLogs", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM notification_logs");
    res.json(toCamel(rows));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/notificationLogs", authenticateJWT, async (req, res) => {
  try {
    const newLogs = req.body;
    const db = await getDB();
    const items = Array.isArray(newLogs) ? newLogs : [newLogs];
    const processedLogs = [];
    
    await db.run("BEGIN TRANSACTION;");
    try {
      for (const l of items) {
        let finalStatus = l.status;

        // If the channel is whatsapp, try to send it via live API
        if (l.channel === "whatsapp") {
          // Parse student name from recipient: "ParentName (F/o StudentName)"
          let studentName = "";
          const match = l.recipient.match(/\(F\/o\s+(.+)\)/i);
          if (match) {
            studentName = match[1].trim();
          }

          let phone = "";
          if (studentName) {
            const studentRow = await db.get("SELECT parent_phone FROM students WHERE name = ?", [studentName]);
            if (studentRow) {
              phone = studentRow.parent_phone;
            }
          }

          if (phone) {
            const result = await sendWhatsAppLive(phone, l.message);
            if (result.success) {
              console.log(`[WhatsApp Gateway] Live manual broadcast sent successfully to ${l.recipient} (${phone})`);
              finalStatus = "Delivered";
            } else {
              const isSimulation = result.error?.includes("credentials missing");
              if (isSimulation) {
                console.log(`[WhatsApp Gateway] (Simulation Mode) Manual broadcast to ${l.recipient} (${phone}): ${l.message}`);
                finalStatus = "Delivered";
              } else {
                console.error(`[WhatsApp Gateway] Failed to send manual broadcast to ${l.recipient}: ${result.error}`);
                finalStatus = "Failed";
              }
            }
          } else {
            console.warn(`[WhatsApp Gateway] Could not resolve phone number for student: ${studentName}. Simulating delivery.`);
          }
        }

        await db.run(
          "INSERT OR REPLACE INTO notification_logs (id, recipient, channel, status, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
          [l.id, l.recipient, l.channel, finalStatus, l.message, l.timestamp]
        );

        processedLogs.push({ ...l, status: finalStatus });
      }
      await db.run("COMMIT;");
      res.status(201).json(processedLogs);
    } catch (txErr) {
      await db.run("ROLLBACK;");
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/holidays", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM holidays");
    res.json(toCamel(rows));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/holidays", authenticateJWT, async (req, res) => {
  try {
    const newHoliday = req.body;
    if (!newHoliday || !newHoliday.id) {
      return res.status(400).json({ message: "Invalid holiday object" });
    }
    const db = await getDB();
    await db.run(
      "INSERT INTO holidays (id, date, name, type, notes) VALUES (?, ?, ?, ?, ?)",
      [newHoliday.id, newHoliday.date, newHoliday.name, newHoliday.type, newHoliday.notes || null]
    );
    res.status(201).json(newHoliday);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/holidays/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    await db.run("DELETE FROM holidays WHERE id = ?", [id]);
    res.json({ message: "Holiday deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const db = await getDB();
    const row = await db.get("SELECT value FROM settings WHERE key = 'config'");
    res.json(row ? JSON.parse(row.value) : {});
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/settings", authenticateJWT, async (req, res) => {
  try {
    const newSettings = SettingsSchema.parse(req.body);
    const db = await getDB();
    await db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('config', ?)",
      [JSON.stringify(newSettings)]
    );
    res.json(newSettings);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.issues[0].message });
    }
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/reset", async (req, res) => {
  try {
    await resetDatabase();
    res.json({ message: "Database reset successfully. All data cleared." });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Serve built frontend files in production
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Live MSG91 WhatsApp Outbound Gateway Dispatcher
async function sendWhatsAppLive(
  recipientPhone: string,
  message: string,
  templateData?: {
    studentName: string;
    batchName: string;
    subject: string;
    attendanceRate: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY || "";
  const whatsappNumber = process.env.MSG91_WHATSAPP_NUMBER || "";
  const templateName = process.env.MSG91_TEMPLATE_NAME || "";

  if (!authKey || !whatsappNumber) {
    return { success: false, error: "MSG91 credentials missing. Simulation mode only." };
  }

  let cleanedPhone = recipientPhone.replace(/\D/g, "");
  if (cleanedPhone.length === 10) {
    cleanedPhone = "91" + cleanedPhone;
  }

  // If templateData is provided, send a templated message
  if (templateData && templateName) {
    const endpoint = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
    const payload = {
      integrated_number: whatsappNumber,
      content_type: "template",
      payload: {
        template_name: templateName,
        language: {
          code: "en"
        },
        recipients: [
          {
            recipient_number: cleanedPhone,
            attributes: {
              student_name: templateData.studentName,
              batch_name: templateData.batchName,
              subject: templateData.subject,
              attendance_rate: templateData.attendanceRate
            }
          }
        ]
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "authkey": authKey,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }

      const data = await response.json() as any;
      if (data.status === "error" || data.hasError) {
        return { success: false, error: data.message || "MSG91 template delivery error." };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network request failed." };
    }
  } else {
    // Otherwise, send a free-form custom text message
    const endpoint = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/";
    const payload = {
      integrated_number: whatsappNumber,
      recipient_number: cleanedPhone,
      content_type: "text",
      text: message
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "authkey": authKey,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }

      const data = await response.json() as any;
      if (data.status === "error" || data.hasError) {
        return { success: false, error: data.message || "MSG91 text delivery error." };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network request failed." };
    }
  }
}

// Background Scheduler for Evening Attendance Digest
let lastDigestSentDate = "";

async function checkAndSendEveningDigest() {
  try {
    const db = await getDB();
    
    // Get settings config
    const settingsRow = await db.get("SELECT value FROM settings WHERE key = 'config'");
    if (!settingsRow) return;
    const settings = JSON.parse(settingsRow.value);
    
    const eveningDigestTime = settings.eveningDigestTime || "19:00";
    const channels = settings.deliveryChannels || { whatsapp: false, email: false };
    
    if (!channels.whatsapp && !channels.email) return;

    // Get current local time in HH:MM format
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;
    
    // Format current date as YYYY-MM-DD
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const currentDateStr = `${year}-${month}-${day}`;

    // If it's time to send the digest and we haven't sent it today yet
    if (currentTimeStr === eveningDigestTime && lastDigestSentDate !== currentDateStr) {
      console.log(`[Scheduler] Triggering evening digest check at ${currentTimeStr}...`);
      
      // Check if today is a holiday
      const holiday = await db.get("SELECT * FROM holidays WHERE date = ?", [currentDateStr]);
      if (holiday) {
        console.log(`[Scheduler] Today is a holiday (${holiday.name}). Skipping evening digest.`);
        lastDigestSentDate = currentDateStr;
        return;
      }

      // Fetch all students
      const studentsRows = await db.all("SELECT * FROM students");
      const students = studentsRows.map(r => ({
        ...r,
        stats: JSON.parse(r.stats),
        history: JSON.parse(r.history)
      }));

      // Find students who were marked Absent today
      const absentStudents = students.filter(s => {
        return s.history.some((h: any) => h.date === currentDateStr && h.status === "Absent");
      });

      if (absentStudents.length === 0) {
        console.log(`[Scheduler] No students were absent today (${currentDateStr}). Skipping evening digest.`);
        lastDigestSentDate = currentDateStr;
        return;
      }

      console.log(`[Scheduler] Found ${absentStudents.length} absent student(s). Dispatching alerts...`);

      await db.run("BEGIN TRANSACTION;");
      try {
        for (const student of absentStudents) {
          const todayAbsentRecords = student.history.filter((h: any) => h.date === currentDateStr && h.status === "Absent");
          
          for (const record of todayAbsentRecords) {
            const batchName = student.batch;
            const subject = record.subject;
            const attendanceRate = student.attendance_percentage || 100.0;
            const parentName = student.parent_name || "Parent";
            const studentName = student.name;
            const parentPhone = student.parent_phone;
            const email = student.email;
            
            let messageTemplate = settings.templates?.absentEnglish || 
              "Dear parent, {{student_name}} was ABSENT from {{batch_name}} {{subject}} session scheduled today. Your ward's current attendance is {{attendance_rate}}% which is below the safe threshold of 75%. Please call us at scholar support to discuss. Regards, Infinity Scholar's Hub.";
            
            let message = messageTemplate
              .replace(/{{student_name}}/g, studentName)
              .replace(/{{batch_name}}/g, batchName)
              .replace(/{{subject}}/g, subject)
              .replace(/{{attendance_rate}}/g, attendanceRate.toString());

            // 1. Send WhatsApp
            if (channels.whatsapp && parentPhone) {
              const logId = `log_wa_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              
              const liveResult = await sendWhatsAppLive(
                parentPhone,
                message,
                {
                  studentName,
                  batchName,
                  subject,
                  attendanceRate: attendanceRate.toString()
                }
              );

              let finalStatus = "Delivered";
              if (liveResult.success) {
                console.log(`[WhatsApp Gateway] Live WhatsApp digest dispatched successfully to parent of ${studentName} (${parentPhone})`);
              } else {
                const isSimulation = liveResult.error?.includes("credentials missing");
                if (isSimulation) {
                  console.log(`[WhatsApp Gateway] (Simulation Mode) Dispatched evening digest to parent of ${studentName} (${parentPhone}): ${message}`);
                  finalStatus = "Delivered";
                } else {
                  console.error(`[WhatsApp Gateway] Failed to send evening digest to parent of ${studentName} (${parentPhone}): ${liveResult.error}`);
                  finalStatus = "Failed";
                }
              }

              await db.run(
                "INSERT INTO notification_logs (id, recipient, channel, status, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                [logId, `${parentName} (${parentPhone})`, "WhatsApp", finalStatus, message, new Date().toISOString()]
              );
            }

            // 2. Send Email
            if (channels.email && email) {
              const logId = `log_em_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              await db.run(
                "INSERT INTO notification_logs (id, recipient, channel, status, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                [logId, `${parentName} (${email})`, "Email", "Delivered", message, new Date().toISOString()]
              );
              console.log(`[Email Outbox] Dispatched evening digest alert to parent of ${studentName} (${email}): ${message}`);
            }
          }
        }
        await db.run("COMMIT;");
        lastDigestSentDate = currentDateStr;
        console.log(`[Scheduler] Evening digest dispatch completed for date ${currentDateStr}.`);
      } catch (txErr) {
        await db.run("ROLLBACK;");
        throw txErr;
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error in evening digest job:", err);
  }
}

// Check every 60 seconds
setInterval(checkAndSendEveningDigest, 60000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
