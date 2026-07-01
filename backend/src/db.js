import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "fuelops.sqlite");

export const db = new DatabaseSync(dbPath);
export const DEFAULT_TIME_ZONE = "Europe/London";

const PERMANENT_ROTA_TEMPLATE = [
  ["VITHTHI", 0, "05:30", "19:00", 0, 30, "Shopping"],
  ["Afridi", 0, "18:00", "22:00", 0, 30, "Shopping"],
  ["VITHTHI", 1, "05:30", "22:00", 0, 30, ""],
  ["VITHTHI", 2, "05:30", "16:00", 0, 30, "Cleaning"],
  ["Veera", 2, "13:00", "22:00", 0, 30, "Cleaning"],
  ["Veera", 3, "05:30", "22:00", 0, 30, ""],
  ["VITHTHI", 4, "13:00", "22:00", 0, 30, "Shopping"],
  ["Veera", 4, "05:30", "14:00", 0, 30, "Shopping"],
  ["VITHTHI", 5, "14:00", "22:00", 0, 30, ""],
  ["Veera", 5, "05:30", "14:00", 0, 30, ""],
  ["Afridi", 6, "05:30", "22:00", 30, 30, ""]
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
      reminderMinutes INTEGER NOT NULL DEFAULT 30,
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
      mustChangePassword INTEGER NOT NULL DEFAULT 1,
      calendarToken TEXT UNIQUE,
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

  await run(`
    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      startTime TEXT NOT NULL DEFAULT '00:00',
      endTime TEXT NOT NULL DEFAULT '23:59',
      note TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS timeOffRequests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      reviewedBy INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id),
      FOREIGN KEY (reviewedBy) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auditLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      shiftId INTEGER,
      timeOffRequestId INTEGER,
      readAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pushSubscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      userAgent TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id)
    )
  `);

  await ensureShiftColumn("isExtra", "INTEGER NOT NULL DEFAULT 0");
  await ensureShiftColumn("coverForStaffId", "INTEGER");
  await ensureShiftColumn("reminderSentAt", "TEXT");
  await ensureShiftColumn("startReminderSentAt", "TEXT");
  await ensureUsersTableShape();
  await ensureSessionsTableShape();
  await ensureTableColumn("notifications", "shiftId", "INTEGER");
  await ensureTableColumn("notifications", "timeOffRequestId", "INTEGER");
  await ensureTableColumn("notifications", "readAt", "TEXT");
  await ensureTableColumn("users", "passwordHash", "TEXT");
  await ensureTableColumn("users", "role", "TEXT NOT NULL DEFAULT 'staff'");
  await ensureTableColumn("users", "staffId", "INTEGER");
  await ensureTableColumn("users", "active", "INTEGER NOT NULL DEFAULT 1");
  await ensureTableColumn("users", "mustChangePassword", "INTEGER NOT NULL DEFAULT 1");
  await ensureTableColumn("users", "calendarToken", "TEXT");
  await ensureTableColumn("users", "createdAt", "TEXT");
  await ensureTableColumn("users", "updatedAt", "TEXT");
  await ensureTableColumn("sessions", "userId", "INTEGER");
  await ensureTableColumn("sessions", "expiresAt", "TEXT");
  await ensureTableColumn("sessions", "createdAt", "TEXT");
  await ensureDefaultSetting("openingStart", "05:30");
  await ensureDefaultSetting("openingEnd", "22:00");
  await ensureDefaultSetting("businessTimezone", DEFAULT_TIME_ZONE);
  await replaceLegacySeedEmails();

  const staffCount = await get("SELECT COUNT(*) AS count FROM staff");
  if (staffCount.count === 0) {
    await seedData();
  }

  await seedUsers();
  await normaliseLegacyReminderMinutes();
  await refreshFutureReminderTimes();
  await ensurePermanentRotaThroughYear(new Date());
}

async function ensureShiftColumn(name, definition) {
  return ensureTableColumn("shifts", name, definition);
}

async function ensureTableColumn(tableName, name, definition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === name)) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${definition}`);
  }
}

async function ensureUsersTableShape() {
  const columns = await all("PRAGMA table_info(users)");
  const columnNames = new Set(columns.map((column) => column.name));
  if (columnNames.has("id") && columnNames.has("username")) return;

  await run("DROP TABLE IF EXISTS sessions");
  await run("DROP TABLE IF EXISTS users");
  await run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      staffId INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      mustChangePassword INTEGER NOT NULL DEFAULT 1,
      calendarToken TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staffId) REFERENCES staff(id)
    )
  `);
}

async function ensureSessionsTableShape() {
  const columns = await all("PRAGMA table_info(sessions)");
  const columnNames = new Set(columns.map((column) => column.name));
  if (columnNames.has("token") && columnNames.has("userId") && columnNames.has("expiresAt")) return;

  await run("DROP TABLE IF EXISTS sessions");
  await run(`
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
}

async function seedData() {
  const staff = [
    ["VITHTHI", "07123 456780", "viththi@example.local", "Manager", 1],
    ["Afridi", "07123 456781", "afridi@example.local", "Fuel Attendant", 1],
    ["Veera", "07123 456782", "veera@example.local", "Cashier", 1]
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
  const admin = await get("SELECT * FROM users WHERE lower(username) = lower(?)", ["admin"]);
  if (!admin) {
    await run(
      "INSERT INTO users (username, passwordHash, role, staffId, active, mustChangePassword) VALUES (?, ?, ?, ?, ?, ?)",
      ["admin", hashPassword("admin123"), "admin", null, 1, 1]
    );
  } else if (!isPasswordHash(admin.passwordHash) || verifyPassword("admin123", admin.passwordHash)) {
    await run(
      "UPDATE users SET passwordHash = ?, role = 'admin', active = 1, mustChangePassword = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [isPasswordHash(admin.passwordHash) ? admin.passwordHash : hashPassword("admin123"), admin.id]
    );
  }

  const staffRows = await all("SELECT id, name FROM staff WHERE active = 1");
  for (const staff of staffRows) {
    const username = toUsername(staff.name);
    const existing = await get("SELECT * FROM users WHERE lower(username) = lower(?)", [username]);
    if (!existing) {
      await run(
        "INSERT INTO users (username, passwordHash, role, staffId, active, mustChangePassword) VALUES (?, ?, ?, ?, ?, ?)",
        [username, hashPassword("staff123"), "staff", staff.id, 1, 1]
      );
    } else if (!isPasswordHash(existing.passwordHash) || verifyPassword("staff123", existing.passwordHash)) {
      await run(
        "UPDATE users SET passwordHash = ?, role = 'staff', staffId = ?, active = 1, mustChangePassword = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
        [isPasswordHash(existing.passwordHash) ? existing.passwordHash : hashPassword("staff123"), staff.id, existing.id]
      );
    }
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

async function normaliseLegacyReminderMinutes() {
  const today = formatDate(new Date());
  const rows = await all(
    "SELECT id, shiftDate, startTime FROM shifts WHERE shiftDate >= ? AND reminderMinutes = 60",
    [today]
  );

  for (const row of rows) {
    await run(
      `UPDATE shifts
       SET reminderMinutes = 30,
           reminderTime = ?,
           reminderSentAt = NULL,
           startReminderSentAt = NULL,
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [calculateReminderTime(row.shiftDate, row.startTime, 30), row.id]
    );
  }
}

function refreshFutureReminderTimes() {
  const today = formatUkDate(new Date());
  const rows = all(
    "SELECT id, shiftDate, startTime, reminderMinutes FROM shifts WHERE shiftDate >= ?",
    [today]
  );

  for (const row of rows) {
    run(
      `UPDATE shifts
       SET reminderTime = ?,
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [calculateReminderTime(row.shiftDate, row.startTime, row.reminderMinutes), row.id]
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

export function calculateReminderTime(shiftDate, startTime, reminderMinutes = 30) {
  const start = ukDateTimeToUtc(shiftDate, startTime);
  start.setMinutes(start.getMinutes() - Number(reminderMinutes || 30));
  return start.toISOString();
}

export function shiftStartInstant(shiftDate, startTime) {
  return ukDateTimeToUtc(shiftDate, startTime);
}

export function decorateShift(row) {
  if (!row) return row;
  const totalHours = calculateHours(row.shiftDate, row.startTime, row.endTime);
  const paidHours = row.approvedTimeOff
    ? 0
    : Math.max(totalHours - Number(row.breakMinutes || 0) / 60, 0);
  return {
    ...row,
    active: row.active === undefined ? undefined : Boolean(row.active),
    isExtra: Boolean(row.isExtra),
    approvedTimeOff: Boolean(row.approvedTimeOff),
    totalHours: Number(totalHours.toFixed(2)),
    paidHours: Number(paidHours.toFixed(2)),
    reminderMessage: buildReminderMessage(row.shiftDate, row.startTime)
  };
}

export function findUserByUsername(username) {
  return get("SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1", [username]);
}

export function verifyPassword(password, storedHash) {
  if (!isPasswordHash(storedHash)) return false;

  const [salt, key] = storedHash.split(":");
  const attempted = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  if (key.length !== attempted.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(attempted, "hex"));
}

function isPasswordHash(value) {
  return typeof value === "string" && /^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(value);
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
    `SELECT users.id, users.username, users.role, users.staffId, users.active, users.mustChangePassword, staff.name AS staffName
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
    staffName: user.staffName,
    mustChangePassword: Boolean(user.mustChangePassword)
  };
}

export function getBranding() {
  const rows = all("SELECT key, value FROM settings WHERE key IN (?, ?, ?)", ["businessName", "logoDataUrl", "businessTimezone"]);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    businessName: values.businessName || "Your Business",
    logoDataUrl: values.logoDataUrl || "",
    businessTimezone: validTimeZone(values.businessTimezone) ? values.businessTimezone : DEFAULT_TIME_ZONE
  };
}

export function getOpeningHours() {
  const rows = all("SELECT key, value FROM settings WHERE key IN (?, ?, ?)", ["openingStart", "openingEnd", "businessTimezone"]);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    openingStart: values.openingStart || "05:30",
    openingEnd: values.openingEnd || "22:00",
    businessTimezone: validTimeZone(values.businessTimezone) ? values.businessTimezone : DEFAULT_TIME_ZONE
  };
}

export function getBusinessTimezone() {
  const value = get("SELECT value FROM settings WHERE key = ?", ["businessTimezone"])?.value;
  return validTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export function updateOpeningHours({ openingStart, openingEnd, businessTimezone }) {
  run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["openingStart", openingStart || "05:30"]
  );
  run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["openingEnd", openingEnd || "22:00"]
  );
  if (businessTimezone !== undefined) {
    run(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ["businessTimezone", validTimeZone(businessTimezone) ? businessTimezone : DEFAULT_TIME_ZONE]
    );
    refreshFutureReminderTimes();
  }
  return getOpeningHours();
}

export function updateBranding({ businessName, logoDataUrl }) {
  if (businessName !== undefined) {
    run(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ["businessName", String(businessName || "Your Business").trim()]
    );
  }

  if (logoDataUrl !== undefined) {
    run(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ["logoDataUrl", String(logoDataUrl || "")]
    );
  }

  return getBranding();
}

export function createStaffUser(staffId, name) {
  const username = toUsername(name);
  const existing = get("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) return existing;

  return run(
    "INSERT INTO users (username, passwordHash, role, staffId, active, mustChangePassword) VALUES (?, ?, ?, ?, ?, ?)",
    [username, hashPassword("staff123"), "staff", staffId, 1, 1]
  );
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${key}`;
}

export function changePassword(userId, newPassword) {
  return run("UPDATE users SET passwordHash = ?, mustChangePassword = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [hashPassword(newPassword), userId]);
}

export function listUsers() {
  return all(
    `SELECT users.id, users.username, users.role, users.staffId, users.active, users.mustChangePassword, staff.name AS staffName
     FROM users
     LEFT JOIN staff ON staff.id = users.staffId
     ORDER BY users.active DESC, users.role ASC, users.username ASC`
  ).map(publicUserWithActive);
}

export function createUser({ username, password, role, staffId, active = true }) {
  const result = run(
    "INSERT INTO users (username, passwordHash, role, staffId, active, mustChangePassword) VALUES (?, ?, ?, ?, ?, ?)",
    [username, hashPassword(password), role, staffId || null, active ? 1 : 0, 1]
  );
  return getUser(result.id);
}

export function updateUser(id, { username, role, staffId, active }) {
  const current = get("SELECT * FROM users WHERE id = ?", [id]);
  if (!current) return null;
  run(
    `UPDATE users
     SET username = ?, role = ?, staffId = ?, active = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      username ?? current.username,
      role ?? current.role,
      staffId === undefined ? current.staffId : staffId || null,
      active === undefined ? current.active : active ? 1 : 0,
      id
    ]
  );
  return getUser(id);
}

export function resetUserPassword(id, password) {
  const result = changePassword(id, password);
  if (result.changes > 0) {
    run("UPDATE users SET mustChangePassword = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  }
  return result.changes > 0;
}

export function ensureUserCalendarToken(userId) {
  const user = get("SELECT id, calendarToken FROM users WHERE id = ?", [userId]);
  if (!user) return "";
  if (user.calendarToken) return user.calendarToken;

  const token = crypto.randomBytes(32).toString("hex");
  run("UPDATE users SET calendarToken = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [token, userId]);
  return token;
}

export function addAudit(userId, action, details = "") {
  return run("INSERT INTO auditLog (userId, action, details) VALUES (?, ?, ?)", [userId || null, action, details]);
}

export function listAudit() {
  return all(
    `SELECT auditLog.*, users.username
     FROM auditLog
     LEFT JOIN users ON users.id = auditLog.userId
     ORDER BY auditLog.createdAt DESC
     LIMIT 80`
  );
}

export function getUser(id) {
  const user = get(
    `SELECT users.id, users.username, users.role, users.staffId, users.active, users.mustChangePassword, staff.name AS staffName
     FROM users
     LEFT JOIN staff ON staff.id = users.staffId
     WHERE users.id = ?`,
    [id]
  );
  return publicUserWithActive(user);
}

function publicUserWithActive(user) {
  if (!user) return null;
  return { ...publicUser(user), active: Boolean(user.active) };
}

async function ensureDefaultSetting(key, value) {
  const existing = await get("SELECT value FROM settings WHERE key = ?", [key]);
  if (!existing) {
    await run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }
}

async function replaceLegacySeedEmails() {
  await run("UPDATE staff SET email = replace(email, '@fuelops.local', '@example.local') WHERE email LIKE ?", ["%@fuelops.local"]);
}

function toUsername(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildReminderMessage(shiftDate, startTime) {
  const today = formatDateInTimeZone(new Date(), getBusinessTimezone());
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
  const start = ukDateTimeToUtc(shiftDate, startTime);
  let endDate = shiftDate;
  let end = ukDateTimeToUtc(endDate, endTime);
  if (end <= start) {
    endDate = formatDate(addDays(new Date(`${shiftDate}T00:00:00`), 1));
    end = ukDateTimeToUtc(endDate, endTime);
  }
  return (end - start) / 36e5;
}

function formatUkDate(date) {
  return formatDateInTimeZone(date, getBusinessTimezone());
}

function formatDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: validTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

function ukDateTimeToUtc(dateString, timeString) {
  const timeZone = getBusinessTimezone();
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = String(timeString || "00:00").split(":").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute || 0, 0);
  const guess = new Date(targetAsUtc);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(guess);
  const zonedAsUtc = Date.UTC(
    Number(part(parts, "year")),
    Number(part(parts, "month")) - 1,
    Number(part(parts, "day")),
    Number(part(parts, "hour")),
    Number(part(parts, "minute")),
    Number(part(parts, "second"))
  );
  return new Date(guess.getTime() + (targetAsUtc - zonedAsUtc));
}

function part(parts, type) {
  return parts.find((item) => item.type === type)?.value || "";
}

export function validTimeZone(timeZone) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return true;
  } catch (_error) {
    return false;
  }
}
