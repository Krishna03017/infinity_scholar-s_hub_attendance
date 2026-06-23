import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { INITIAL_SETTINGS } from "../data/mockData.ts";

// DB file is located in the root of the workspace or defined by env var
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "db.sqlite");

let dbConnection: Database | null = null;

export async function getDB(): Promise<Database> {
  if (dbConnection) return dbConnection;

  dbConnection = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbConnection.exec("PRAGMA foreign_keys = ON;");
  
  await initializeDatabase(dbConnection);
  return dbConnection;
}

async function initializeDatabase(db: Database) {
  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      parent_phone TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      batch TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      target_threshold REAL DEFAULT 75,
      attendance_percentage REAL DEFAULT 100,
      status TEXT DEFAULT 'Active',
      stats TEXT NOT NULL,
      history TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      subjects TEXT NOT NULL DEFAULT '[]',
      submission_rate REAL DEFAULT 100,
      status TEXT DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      batch_name TEXT NOT NULL,
      batch_tag TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      time TEXT NOT NULL,
      room TEXT NOT NULL,
      students_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      assigned_faculty TEXT NOT NULL,
      marked_by TEXT,
      present_count INTEGER,
      absent_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default data if users table is empty
  const userCount = await db.get("SELECT COUNT(*) as count FROM users");
  if (userCount.count === 0) {
    await seedDatabase(db);
  }
}

async function seedDatabase(db: Database) {
  console.log("[Database] Seeding admin account and default settings...");

  // Only one admin account — no coordinator, no faculty logins
  const adminHash = await bcrypt.hash("EduInfinity12#", 10);
  await db.run(
    "INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)",
    ["usr_admin", "admin", adminHash, "admin", "Principal Administrator"]
  );

  // Seed default settings config
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?)",
    ["config", JSON.stringify(INITIAL_SETTINGS)]
  );

  console.log("[Database] Seeding complete. Admin account ready. Add faculty and students through the admin portal.");
}

// Reset helper — wipes all tables and re-seeds
export async function resetDatabase() {
  const db = await getDB();
  console.log("[Database] Wiping all tables and re-initialising with clean admin account...");
  await db.exec(`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS students;
    DROP TABLE IF EXISTS faculty;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS holidays;
    DROP TABLE IF EXISTS notification_logs;
    DROP TABLE IF EXISTS settings;
  `);
  // Null connection so initializeDatabase re-runs fully
  dbConnection = null;
  await getDB();
}
