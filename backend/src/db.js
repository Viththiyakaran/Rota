import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "fuelops.sqlite");

export const db = new DatabaseSync(dbPath);

const PERMANENT_ROTA_TEMPLATE = [
  ["VITHTHI", 0, "05:30", "19:00", 0, 60, "Shopping"],
  ["Afridi", 0, "18:00", "22:00", 0, 60, "Shopping"],
  ["VITHTHI", 1, "05:30", "22:00", 0, 60, ""],
  ["VITHTHI", 2, "05:30", "16:00", 0, 60, "Cleaning"],
  ["Veera", 2, "13:00", "22:00", 0, 60, "Cleaning"],
  ["Veera", 3, "05:30", "22:00", 0, 60, ""],
  ["VITHTHI", 4, "13:00", "22:00", 0, 60, "Shopping"],
  ["Veera", 4, "05:30", "14:00", 0, 60, "Shopping"],
  ["VITHTHI", 5, "14:00", "22:00", 0, 60, ""],
  ["Veera", 5, "05:30", "14:00", 0, 60, ""],
  ["Afridi", 6, "05:30", "22:00", 30, 60, ""]
];

export function run(sql, params = []) {
  const result = db.prepare(sql).run(...params);
  return {
    id: Number(result.lastInsertRowid || 0),
    changes: result.changes
  };
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export async function initDb() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      shiftDate TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      breakMinutes INTEGER NOT NULL DEFAULT 0,
      reminderMinutes INTEGER NOT NULL DEFAULT 60,
      reminderTime TEXT NOT NULL,
      notes TEXT,
      isExtra INTEGER NOT NULL DEFAULT 0,
      coverForStaffId INTEGER,
      googleCalendarEventId TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id),
      FOREIGN KEY (coverForStaffId) REFERENCES staff(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
      staffId INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await ensureShiftColumn("isExtra", "INTEGER NOT NULL DEFAULT 0");
  await ensureShiftColumn("coverForStaffId", "INTEGER");

  const staffCount = await get("SELECT COUNT(*) AS count FROM staff");
  if (staffCount.count === 0) {
    await seedData();
  }

  await seedUsers();
  await ensurePermanentRotaThroughYear(new Date());
}

async function ensureShiftColumn(name, definition) {
  const columns = await all("PRAGMA table_info(shifts)");
  if (!columns.some((column) => column.name === name)) {
    await run(`ALTER TABLE shifts ADD COLUMN ${name} ${definition}`);
  }
}

async function seedData() {
  const staff = [
    ["VITHTHI", "07123 456780", "viththi@fuelops.local", "Manager", 1],
    ["Afridi", "07123 456781", "afridi@fuelops.local", "Fuel Attendant", 1],
    ["Veera", "07123 456782", "veera@fuelops.local", "Cashier", 1]
  ];

  for (const person of staff) {
    await run(
      "INSERT INTO staff (name, phone, email, role, active) VALUES (?, ?, ?, ?, ?)",
      person
    );
  }

  await insertPermanentWeek(getMonday(new Date()), endOfYear(new Date()));
}

async function seedUsers() {
  const userCount = await get("SELECT COUNT(*) AS count FROM users");
  if (userCount.count > 0) return;

  await run(
    "INSERT INTO users (username, passwordHash, role, staffId, active) VALUES (?, ?, ?, ?, ?)",
    ["admin", hashPassword("admin123"), "admin", null, 1]
  );

  const staffRows = await all("SELECT id, name FROM staff WHERE active = 1");
  for (const staff of staffRows) {
    await run(
      "INSERT INTO users (username, passwordHash, role, staffId, active) VALUES (?, ?, ?, ?, ?)",
      [toUsername(staff.name), hashPassword("staff123"), "staff", staff.id, 1]
    );
  }
}

async function ensurePermanentRotaThroughYear(date) {
  const yearEnd = endOfYear(date);
  const yearEndValue = formatDate(yearEnd);
  const settingKey = `permanentRotaGeneratedUntil:${date.getFullYear()}`;
  const current = await get("SELECT value FROM settings WHERE key = ?", [settingKey]);

  if (current && current.value >= yearEndValue) return;

  let weekStart = getMonday(date);
  while (weekStart <= yearEnd) {
    await insertPermanentWeek(weekStart, yearEnd);
    weekStart = addDays(weekStart, 7);
  }

  await run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [settingKey, yearEndValue]
  );
}

async function insertPermanentWeek(monday, yearEnd) {
  const staffRows = await all("SELECT id, name FROM staff");
  const staffByName = new Map(staffRows.map((person) => [person.name, person.id]));

  for (const shift of PERMANENT_ROTA_TEMPLATE) {
    const [staffName, dayOffset, startTime, endTime, breakMinutes, reminderMinutes, notes] = shift;
    const staffId = staffByName.get(staffName);
    if (!staffId) continue;

    const shiftDateObject = addDays(monday, dayOffset);
    if (shiftDateObject > yearEnd) continue;

    const shiftDate = formatDate(shiftDateObject);
    const existing = await get(
      `SELECT id FROM shifts
       WHERE staffId = ? AND shiftDate = ? AND startTime = ? AND endTime = ? AND isExtra = 0`,
      [staffId, shiftDate, startTime, endTime]
    );
    if (existing) continue;

    await run(
      `INSERT INTO shifts
        (staffId, shiftDate, startTime, endTime, breakMinutes, reminderMinutes, reminderTime, notes, isExtra, coverForStaffId, googleCalendarEventId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffId,
        shiftDate,
        startTime,
        endTime,
        breakMinutes,
        reminderMinutes,
        calculateReminderTime(shiftDate, startTime, reminderMinutes),
        notes,
        0,
        null,
        null
      ]
    );
  }
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function getMonday(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateReminderTime(shiftDate, startTime, reminderMinutes = 60) {
  const start = new Date(`${shiftDate}T${startTime}:00`);
  start.setMinutes(start.getMinutes() - Number(reminderMinutes || 60));
  return start.toISOString();
}

export function decorateShift(row) {
  if (!row) return row;
  const totalHours = calculateHours(row.shiftDate, row.startTime, row.endTime);
  const paidHours = Math.max(totalHours - Number(row.breakMinutes || 0) / 60, 0);
  return {
    ...row,
    active: row.active === undefined ? undefined : Boolean(row.active),
    isExtra: Boolean(row.isExtra),
    totalHours: Number(totalHours.toFixed(2)),
    paidHours: Number(paidHours.toFixed(2)),
    reminderMessage: buildReminderMessage(row.shiftDate, row.startTime)
  };
}

export function findUserByUsername(username) {
  return get("SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1", [username]);
}

export function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const attempted = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  if (key.length !== attempted.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(attempted, "hex"));
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  run("INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)", [token, userId, expiresAt]);
  return { token, expiresAt };
}

export function deleteSession(token) {
  return run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function getSessionUser(token) {
  if (!token) return null;
  return get(
    `SELECT users.id, users.username, users.role, users.staffId, users.active, staff.name AS staffName
     FROM sessions
     JOIN users ON users.id = sessions.userId
     LEFT JOIN staff ON staff.id = users.staffId
     WHERE sessions.token = ? AND sessions.expiresAt > ? AND users.active = 1`,
    [token, new Date().toISOString()]
  );
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    staffId: user.staffId,
    staffName: user.staffName
  };
}

export function createStaffUser(staffId, name) {
  const username = toUsername(name);
  const existing = get("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) return existing;

  return run(
    "INSERT INTO users (username, passwordHash, role, staffId, active) VALUES (?, ?, ?, ?, ?)",
    [username, hashPassword("staff123"), "staff", staffId, 1]
  );
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${key}`;
}

function toUsername(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildReminderMessage(shiftDate, startTime) {
  const today = formatDate(new Date());
  if (shiftDate === today) {
    return `Your shift starts at ${startTime} today`;
  }

  const label = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(`${shiftDate}T00:00:00`));
  return `Your shift starts at ${startTime} on ${label}`;
}

function calculateHours(shiftDate, startTime, endTime) {
  const start = new Date(`${shiftDate}T${startTime}:00`);
  const end = new Date(`${shiftDate}T${endTime}:00`);
  if (end <= start) end.setDate(end.getDate() + 1);
  return (end - start) / 36e5;
}
