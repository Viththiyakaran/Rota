import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rota-smoke-"));
const dbPath = path.join(tempDir, "smoke.sqlite");
const port = String(4700 + Math.floor(Math.random() * 1000));
const base = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ["--no-warnings", "src/server.js"], {
  cwd: path.join(root, "backend"),
  env: { ...process.env, PORT: port, DB_PATH: dbPath },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForServer();
  await runSmoke();
  console.log("smoke ok");
} finally {
  await stopServer();
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function runSmoke() {
  const publicBranding = await request("/api/settings/branding");
  assert(publicBranding.businessName, "public branding works");

  const admin = await login("admin", "admin123");
  const staff = await login("afridi", "staff123");

  const changedAdmin = await request("/api/auth/change-password", {
    cookie: admin.cookie,
    method: "POST",
    body: { currentPassword: "admin123", newPassword: "admin456" }
  });
  assert(changedAdmin.user?.mustChangePassword === false, "admin first password change");

  const changedStaff = await request("/api/auth/change-password", {
    cookie: staff.cookie,
    method: "POST",
    body: { currentPassword: "staff123", newPassword: "staff456" }
  });
  assert(changedStaff.user?.mustChangePassword === false, "staff first password change");

  const staffRows = await request("/api/staff", { cookie: admin.cookie });
  assert(staffRows.length >= 3, "seed staff exists");

  await request("/api/settings/branding", {
    cookie: admin.cookie,
    method: "PUT",
    body: { businessName: "Smoke Shop", logoDataUrl: "" }
  });

  await request("/api/settings/opening-hours", {
    cookie: admin.cookie,
    method: "PUT",
    body: { openingStart: "06:00", openingEnd: "21:00" }
  });
  const hours = await request("/api/settings/opening-hours", { cookie: admin.cookie });
  assert(hours.openingStart === "06:00", "opening hours save");

  const createdStaff = await request("/api/staff", {
    cookie: admin.cookie,
    method: "POST",
    body: { name: "Smoke Staff", phone: "07123000000", email: "smoke@example.local", role: "Cashier", active: true }
  });
  assert(createdStaff.id, "create staff");

  const users = await request("/api/users", { cookie: admin.cookie });
  assert(users.some((user) => user.username === "smokestaff"), "staff login auto-created");

  await request("/api/users", {
    cookie: admin.cookie,
    method: "POST",
    body: { username: "smokeadmin", password: "admin123", role: "admin", staffId: null, active: true }
  });

  await expectStatus("/api/users", 403, { cookie: staff.cookie });

  const shift = await request("/api/shifts", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      staffId: staffRows[0].id,
      shiftDate: "2026-07-01",
      startTime: "06:00",
      endTime: "14:00",
      breakMinutes: 0,
      reminderMinutes: 60,
      notes: "Smoke"
    }
  });
  assert(shift.totalHours === 8, "shift hours calculated");

  const week = await request("/api/shifts/week?startDate=2026-06-29", { cookie: admin.cookie });
  assert(week.some((item) => item.id === shift.id), "week includes created shift");

  const myShifts = await request("/api/shifts/my", { cookie: staff.cookie });
  assert(Array.isArray(myShifts), "staff my shifts works");

  const reminders = await request("/api/reminders/upcoming", { cookie: admin.cookie });
  assert(Array.isArray(reminders), "reminders works");

  const availability = await request("/api/availability", {
    cookie: staff.cookie,
    method: "POST",
    body: { weekday: 2, startTime: "09:00", endTime: "12:00", note: "College" }
  });
  assert(availability.id, "staff availability create");

  const timeOff = await request("/api/time-off", {
    cookie: staff.cookie,
    method: "POST",
    body: { startDate: "2026-07-10", endDate: "2026-07-11", reason: "Holiday" }
  });
  assert(timeOff.id, "staff time off create");

  await expectStatus("/api/time-off", 400, {
    cookie: staff.cookie,
    method: "POST",
    body: { startDate: "2026-07-12", endDate: "2026-07-10", reason: "Bad range" }
  });

  const reviewed = await request(`/api/time-off/${timeOff.id}`, {
    cookie: admin.cookie,
    method: "PUT",
    body: { status: "approved" }
  });
  assert(reviewed.status === "approved", "admin approves time off");

  const copy = await request("/api/shifts/copy-week", {
    cookie: admin.cookie,
    method: "POST",
    body: { fromStartDate: "2026-06-29", toStartDate: "2026-07-06" }
  });
  assert(Number.isInteger(copy.copied), "copy week works");

  await request("/api/auth/change-password", {
    cookie: staff.cookie,
    method: "POST",
    body: { currentPassword: "staff456", newPassword: "staff789" }
  });
  await login("afridi", "staff789");

  const audit = await request("/api/audit", { cookie: admin.cookie });
  assert(audit.length > 0, "audit log works");
}

async function login(username, password) {
  const result = await request("/api/auth/login", { method: "POST", body: { username, password } });
  assert(result.user, `login ${username}`);
  assert(result.cookie, `login cookie ${username}`);
  return result;
}

async function request(route, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(`${base}${route}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${route} failed ${response.status}: ${text}`);
  }
  if (response.status === 204) return null;
  const result = await response.json();
  const cookie = getResponseCookie(response);
  return cookie ? { ...result, cookie } : result;
}

async function expectStatus(route, status, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(`${base}${route}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  assert(response.status === status, `${route} returns ${status}`);
}

function getResponseCookie(response) {
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  const setCookie = cookies[0] || response.headers.get("set-cookie") || "";
  return setCookie.split(";")[0] || "";
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Server did not start. Output:\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const closed = new Promise((resolve) => server.once("close", resolve));
  server.kill();
  await closed;
}
