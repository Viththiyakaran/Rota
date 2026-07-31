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
  env: { ...process.env, PORT: port, DB_PATH: dbPath, DATABASE_URL: "", ADMIN_RESET_TOKEN: "smoke-reset-token" },
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
  const rootStatus = await request("/");
  assert(rootStatus.status === "running", "root status works");

  const rootPage = await fetch(`${base}/`, { headers: { Accept: "text/html" } });
  assert(rootPage.ok, "root frontend route works");
  assert((rootPage.headers.get("content-type") || "").includes("text/html"), "root serves frontend html for browsers");

  const health = await request("/health");
  assert(health.status === "ok", "health works");

  const routeList = await request("/api");
  assert(routeList.endpoints?.includes("GET /api/staff"), "api route list works");
  assert(routeList.endpoints?.includes("PUT /api/sales"), "sales route is listed");

  const publicBranding = await request("/api/settings/branding");
  assert(publicBranding.businessName, "public branding works");

  let admin = await login("admin", "admin123");

  const changedAdmin = await request("/api/auth/change-password", {
    cookie: admin.cookie,
    method: "POST",
    body: { currentPassword: "admin123", newPassword: "admin456" }
  });
  assert(changedAdmin.user?.mustChangePassword === false, "admin first password change");

  const savedUkRules = await request("/api/settings/uk-rules", {
    cookie: admin.cookie,
    method: "PUT",
    body: {
      warnShiftOver6HoursNoBreak: false,
      thresholdHours: 6,
      minimumBreakMinutes: 20,
      warnLessThan11HoursRest: false,
      dailyRestHours: 11,
      warnHighWeeklyHours: false,
      weeklyHoursThreshold: 48,
      warnBelowMinimumWage: false,
      minimumHourlyRate: 12.21,
      clockInEnabled: false,
      locationCheckEnabled: false,
      wageCostEnabled: false,
      showWageCostOnDashboard: false
    }
  });
  assert(savedUkRules.warnShiftOver6HoursNoBreak === false, "uk break warning saves false");
  assert(savedUkRules.warnLessThan11HoursRest === false, "uk daily rest warning saves false");
  const reloadedUkRules = await request("/api/settings/uk-rules", { cookie: admin.cookie });
  assert(reloadedUkRules.warnShiftOver6HoursNoBreak === false, "uk break warning reloads false");
  assert(reloadedUkRules.warnLessThan11HoursRest === false, "uk daily rest warning reloads false");

  const staff = await login("afridi", "staff123");

  await expectStatus("/api/auth/recover-admin", 403, {
    method: "POST",
    body: { token: "wrong-token", username: "admin", newPassword: "admin789" }
  });
  const recoveredAdmin = await request("/api/auth/recover-admin", {
    method: "POST",
    body: { token: "smoke-reset-token", username: "admin", newPassword: "admin789" }
  });
  assert(recoveredAdmin.ok, "admin recovery reset works");
  admin = await login("admin", "admin789");
  assert(admin.user.mustChangePassword === true, "admin recovery forces password change");
  const changedRecoveredAdmin = await request("/api/auth/change-password", {
    cookie: admin.cookie,
    method: "POST",
    body: { currentPassword: "admin789", newPassword: "admin456" }
  });
  assert(changedRecoveredAdmin.user?.mustChangePassword === false, "admin recovered password changed");
  admin = await login("admin", "admin456");

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
    body: { businessName: "Smoke Shop", logoDataUrl: "", performanceTrackerEnabled: false }
  });
  const disabledPerformanceBranding = await request("/api/settings/branding");
  assert(disabledPerformanceBranding.performanceTrackerEnabled === false, "performance tracker can be disabled");
  await request("/api/settings/branding", {
    cookie: admin.cookie,
    method: "PUT",
    body: { performanceTrackerEnabled: true }
  });
  const enabledPerformanceBranding = await request("/api/settings/branding");
  assert(enabledPerformanceBranding.performanceTrackerEnabled === true, "performance tracker can be enabled");

  await request("/api/settings/opening-hours", {
    cookie: admin.cookie,
    method: "PUT",
    body: { openingStart: "06:00", openingEnd: "21:00" }
  });
  const hours = await request("/api/settings/opening-hours", { cookie: admin.cookie });
  assert(hours.openingStart === "06:00", "opening hours save");

  const savedSales = await request("/api/sales", {
    cookie: admin.cookie,
    method: "PUT",
    body: {
      entries: [
        { saleDate: "2026-07-20", amount: 8200.5 },
        { saleDate: "2026-07-27", amount: 9100.75 }
      ]
    }
  });
  assert(savedSales.length === 2, "daily sales save");
  const sales = await request("/api/sales?startDate=2026-07-20&endDate=2026-07-27", { cookie: admin.cookie });
  assert(sales[0].amount === 8200.5 && sales[1].amount === 9100.75, "daily sales reload");
  const salesCommunication = await request("/api/sales/communication", {
    cookie: admin.cookie,
    method: "PUT",
    body: { weekStart: "2026-07-27", communication: "Focus on weekend add-on sales." }
  });
  assert(salesCommunication.communication === "Focus on weekend add-on sales.", "sales communication saves");
  const reloadedSalesCommunication = await request("/api/sales/communication?weekStart=2026-07-27", { cookie: admin.cookie });
  assert(reloadedSalesCommunication.communication === "Focus on weekend add-on sales.", "sales communication reloads");
  await expectStatus("/api/sales?startDate=2026-07-20&endDate=2026-07-27", 403, { cookie: staff.cookie });
  await expectStatus("/api/sales/communication?weekStart=2026-07-27", 403, { cookie: staff.cookie });

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

  const assignedTask = await request("/api/tasks", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      title: "Check task assignment",
      description: "Smoke test",
      dueDate: "2026-07-01",
      status: "todo",
      assignedStaffId: staffRows[0].id
    }
  });
  assert(assignedTask.assignedStaffId === staffRows[0].id, "admin assigns task");

  const reassignedTask = await request(`/api/tasks/${assignedTask.id}`, {
    cookie: admin.cookie,
    method: "PUT",
    body: { assignedStaffId: createdStaff.id }
  });
  assert(reassignedTask.assignedStaffId === createdStaff.id, "admin reassigns task");

  const claimableTask = await request("/api/tasks", {
    cookie: admin.cookie,
    method: "POST",
    body: { title: "Claim this task", dueDate: "2026-07-01", status: "backlog" }
  });
  const claimedTask = await request(`/api/tasks/${claimableTask.id}`, {
    cookie: staff.cookie,
    method: "PUT",
    body: { assignedStaffId: staff.user.staffId }
  });
  assert(claimedTask.assignedStaffId === staff.user.staffId, "staff claims unassigned task");

  await expectStatus(`/api/tasks/${claimableTask.id}`, 403, {
    cookie: staff.cookie,
    method: "PUT",
    body: { assignedStaffId: createdStaff.id }
  });
  await expectStatus(`/api/tasks/${claimableTask.id}`, 403, {
    cookie: staff.cookie,
    method: "DELETE"
  });

  const completedTask = await request(`/api/tasks/${assignedTask.id}`, {
    cookie: admin.cookie,
    method: "PUT",
    body: { status: "done" }
  });
  assert(completedTask.completedAt, "completed task records completion time");
  assert(completedTask.archived === false, "newly completed task remains on board");
  const completedTasks = await request("/api/tasks/completed", { cookie: admin.cookie });
  assert(completedTasks.some((task) => task.id === assignedTask.id), "completed task appears in history");
  await expectStatus("/api/tasks/completed", 403, { cookie: staff.cookie });
  const activeTasks = await request("/api/tasks", { cookie: admin.cookie });
  assert(activeTasks.some((task) => task.id === assignedTask.id), "completed task remains active for archive window");

  const restoredTask = await request(`/api/tasks/${assignedTask.id}`, {
    cookie: admin.cookie,
    method: "PUT",
    body: { status: "todo" }
  });
  assert(restoredTask.completedAt === null, "restoring task clears completion time");
  const completedAfterRestore = await request("/api/tasks/completed", { cookie: admin.cookie });
  assert(!completedAfterRestore.some((task) => task.id === assignedTask.id), "restored task leaves completed history");

  await request(`/api/tasks/${assignedTask.id}`, { cookie: admin.cookie, method: "DELETE" });
  await request(`/api/tasks/${claimableTask.id}`, { cookie: admin.cookie, method: "DELETE" });

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

  const followingWeekShift = await request("/api/shifts", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      staffId: staffRows[0].id,
      shiftDate: "2026-07-08",
      startTime: "06:00",
      endTime: "14:00",
      breakMinutes: 0,
      reminderMinutes: 60,
      notes: "Following week"
    }
  });
  const editedShift = await request(`/api/shifts/${shift.id}`, {
    cookie: admin.cookie,
    method: "PUT",
    body: { startTime: "13:30", endTime: "22:00", breakMinutes: 0 }
  });
  assert(editedShift.startTime === "13:30" && editedShift.totalHours === 8.5, "single shift time edit works");
  const followingWeek = await request("/api/shifts/week?startDate=2026-07-06", { cookie: admin.cookie });
  const untouchedShift = followingWeek.find((item) => item.id === followingWeekShift.id);
  assert(untouchedShift?.startTime === "06:00" && untouchedShift?.endTime === "14:00", "single shift edit does not change another week");

  const staffDraftView = await request("/api/shifts/week?startDate=2026-06-29", { cookie: staff.cookie });
  assert(!staffDraftView.some((item) => item.id === shift.id), "staff cannot see unpublished shift changes");
  const publicationStatus = await request("/api/shifts/publication?startDate=2026-06-29", { cookie: admin.cookie });
  assert(publicationStatus.changes > 0, "admin sees unpublished rota changes");
  const publication = await request("/api/shifts/publish", {
    cookie: admin.cookie,
    method: "POST",
    body: { startDate: "2026-06-29" }
  });
  assert(publication.ok && publication.changes > 0, "admin publishes rota changes");
  const staffPublishedView = await request("/api/shifts/week?startDate=2026-06-29", { cookie: staff.cookie });
  assert(staffPublishedView.some((item) => item.id === shift.id && item.startTime === "13:30"), "staff sees latest published rota");
  const publishedStatus = await request("/api/shifts/publication?startDate=2026-06-29", { cookie: admin.cookie });
  assert(publishedStatus.changes === 0, "published rota has no pending changes");

  const staffNotifications = await request("/api/notifications", { cookie: admin.cookie });
  const unreadNotification = staffNotifications.find((notification) => notification.unread);
  assert(unreadNotification?.id, "shift creates a notification");
  await request(`/api/notifications/${unreadNotification.id}/read`, { cookie: admin.cookie, method: "POST" });
  const updatedNotifications = await request("/api/notifications", { cookie: admin.cookie });
  assert(updatedNotifications.find((notification) => notification.id === unreadNotification.id)?.unread === false, "single notification can be marked read");

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

  const pattern = await request("/api/rota-patterns/generate", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      startDate: "2026-08-03",
      endMode: "1m",
      replaceGenerated: true,
      entries: [
        { staffId: staffRows[0].id, dayOffset: 0, startTime: "09:00", endTime: "17:00", breakMinutes: 30, reminderMinutes: 30, notes: "Pattern test" }
      ]
    }
  });
  assert(pattern.created > 0, "rota pattern generation works");

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
