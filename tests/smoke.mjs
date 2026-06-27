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

  const staffRows = await request("/api/staff", { token: admin.token });
  assert(staffRows.length >= 3, "seed staff exists");

  await request("/api/settings/branding", {
    token: admin.token,
    method: "PUT",
    body: { businessName: "Smoke Shop", logoDataUrl: "" }
  });

  await request("/api/settings/opening-hours", {
    token: admin.token,
    method: "PUT",
    body: { openingStart: "06:00", openingEnd: "21:00" }
  });
  const hours = await request("/api/settings/opening-hours", { token: admin.token });
  assert(hours.openingStart === "06:00", "opening hours save");

  const createdStaff = await request("/api/staff", {
    token: admin.token,
    method: "POST",
    body: { name: "Smoke Staff", phone: "07123000000", email: "smoke@example.local", role: "Cashier", active: true }
  });
  assert(createdStaff.id, "create staff");

  const users = await request("/api/users", { token: admin.token });
  assert(users.some((user) => user.username === "smokestaff"), "staff login auto-created");

  await request("/api/users", {
    token: admin.token,
    method: "POST",
    body: { username: "smokeadmin", password: "admin123", role: "admin", active: true }
  });

  await expectStatus("/api/users", 403, { token: staff.token });

  const shift = await request("/api/shifts", {
    token: admin.token,
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

  const week = await request("/api/shifts/week?startDate=2026-06-29", { token: admin.token });
  assert(week.some((item) => item.id === shift.id), "week includes created shift");

  const myShifts = await request("/api/shifts/my", { token: staff.token });
  assert(Array.isArray(myShifts), "staff my shifts works");

  const reminders = await request("/api/reminders/upcoming", { token: admin.token });
  assert(Array.isArray(reminders), "reminders works");

  const availability = await request("/api/availability", {
    token: staff.token,
    method: "POST",
    body: { weekday: 2, startTime: "09:00", endTime: "12:00", note: "College" }
  });
  assert(availability.id, "staff availability create");

  const timeOff = await request("/api/time-off", {
    token: staff.token,
    method: "POST",
    body: { startDate: "2026-07-10", endDate: "2026-07-11", reason: "Holiday" }
  });
  assert(timeOff.id, "staff time off create");

  const reviewed = await request(`/api/time-off/${timeOff.id}`, {
    token: admin.token,
    method: "PUT",
    body: { status: "approved" }
  });
  assert(reviewed.status === "approved", "admin approves time off");

  const copy = await request("/api/shifts/copy-week", {
    token: admin.token,
    method: "POST",
    body: { fromStartDate: "2026-06-29", toStartDate: "2026-07-06" }
  });
  assert(Number.isInteger(copy.copied), "copy week works");

  await request("/api/auth/change-password", {
    token: staff.token,
    method: "POST",
    body: { currentPassword: "staff123", newPassword: "staff456" }
  });
  await login("afridi", "staff456");

  const audit = await request("/api/audit", { token: admin.token });
  assert(audit.length > 0, "audit log works");
}

async function login(username, password) {
  const result = await request("/api/auth/login", { method: "POST", body: { username, password } });
  assert(result.token, `login ${username}`);
  return result;
}

async function request(route, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
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
  return response.json();
}

async function expectStatus(route, status, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${base}${route}`, { headers });
  assert(response.status === status, `${route} returns ${status}`);
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
