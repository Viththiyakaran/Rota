import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";
import {
  all,
  addAudit,
  calculateReminderTime,
  changePassword,
  createUser,
  createSession,
  createStaffUser,
  decorateShift,
  deleteSession,
  ensureUserCalendarToken,
  findUserByUsername,
  get,
  getBusinessTimezone,
  getBranding,
  getOpeningHours,
  getSessionUser,
  hashPassword,
  initDb,
  listAudit,
  listUsers,
  publicUser,
  run,
  resetUserPassword,
  shiftStartInstant,
  updateOpeningHours,
  updateUser,
  updateBranding,
  validTimeZone,
  verifyPassword
} from "./db.js";

const app = express();
const PORT = process.env.PORT || 5000;
const appVersion = "1.0.0";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;
let pushConfigured = false;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.set("trust proxy", 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
  const wantsHtml = String(req.get("accept") || "").includes("text/html");
  if (wantsHtml && fs.existsSync(frontendDist)) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }

  res.json({
    app: "FuelOps Rota Backend",
    status: "running",
    version: appVersion,
    message: "API is live"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "FuelOps Rota Backend",
    version: appVersion,
    authMigration: 3
  });
});

app.get("/api", (_req, res) => {
  res.json({
    app: "FuelOps Rota Backend",
    version: appVersion,
    endpoints: [
      "GET /",
      "GET /health",
      "GET /api",
      "GET /api/health",
      "GET /api/settings/branding",
      "POST /api/auth/login",
      "POST /api/auth/recover-admin",
      "GET /api/auth/me",
      "POST /api/auth/logout",
      "POST /api/auth/change-password",
      "GET /api/staff",
      "POST /api/staff",
      "PUT /api/staff/:id",
      "GET /api/shifts/week?startDate=yyyy-mm-dd",
      "GET /api/shifts/my",
      "POST /api/shifts/copy-week",
      "POST /api/shifts",
      "PUT /api/shifts/:id",
      "DELETE /api/shifts/:id",
      "GET /api/reminders/upcoming",
      "GET /api/push/public-key",
      "GET /api/push/status",
      "POST /api/push/subscribe",
      "POST /api/push/test",
      "GET /api/calendar/my-feed",
      "GET /calendar/:token.ics",
      "GET /api/notifications",
      "POST /api/notifications/read-all",
      "GET /api/time-off",
      "POST /api/time-off",
      "PUT /api/time-off/:id",
      "GET /api/availability",
      "POST /api/availability",
      "DELETE /api/availability/:id",
      "GET /api/tasks",
      "POST /api/tasks",
      "PUT /api/tasks/:id",
      "DELETE /api/tasks/:id",
      "GET /api/audit"
    ]
  });
});

app.get("/api/settings/branding", (_req, res) => {
  res.json(getBranding());
});

app.get("/calendar/:token.ics", async (req, res, next) => {
  try {
    const token = String(req.params.token || "").replace(/\.ics$/, "");
    const user = await get(
      `SELECT users.id, users.staffId, users.username, staff.name AS staffName
       FROM users
       JOIN staff ON staff.id = users.staffId
       WHERE users.calendarToken = ? AND users.active = 1 AND staff.active = 1`,
      [token]
    );
    if (!user?.staffId) return res.status(404).type("text/plain").send("Calendar not found");

    const today = new Date().toISOString().slice(0, 10);
    const until = addDays(today, 180);
    const rows = await all(
      `SELECT shifts.*, staff.name AS staffName, staff.role, staff.active,
              coverStaff.name AS coverForStaffName
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       LEFT JOIN timeOffRequests
         ON timeOffRequests.staffId = shifts.staffId
        AND timeOffRequests.status = 'approved'
        AND timeOffRequests.endDate >= timeOffRequests.startDate
        AND shifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
       WHERE shifts.staffId = ?
         AND shifts.shiftDate BETWEEN ? AND ?
         AND timeOffRequests.id IS NULL
       ORDER BY shifts.shiftDate ASC, shifts.startTime ASC`,
      [user.staffId, today, until]
    );

    const branding = getBranding();
    const calendar = buildIcsCalendar({
      name: `${branding.businessName || "Business"} Rota - ${user.staffName || user.username}`,
      shifts: rows.map(decorateShift)
    });

    res
      .status(200)
      .set({
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${safeFilename(user.staffName || "my-shifts")}-rota.ics"`,
        "Cache-Control": "private, max-age=300"
      })
      .send(calendar);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/recover-admin", async (req, res, next) => {
  try {
    const recoveryToken = process.env.ADMIN_RESET_TOKEN;
    if (!recoveryToken) return res.status(404).json({ error: "Admin recovery is not enabled." });

    const { token = "", username = "admin", newPassword = "" } = req.body;
    if (token !== recoveryToken) return res.status(403).json({ error: "Invalid recovery token." });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });

    const user = findUserByUsername(String(username).trim());
    if (!user || user.role !== "admin") return res.status(404).json({ error: "Admin user not found." });

    resetUserPassword(user.id, newPassword);
    addAudit(user.id, "recover_admin_password", `Recovered admin login ${user.username}`);
    res.json({ ok: true, username: user.username, mustChangePassword: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { username = "", password = "" } = req.body;
    const loginKey = getLoginRateKey(req, username);
    if (isRateLimited(loginKey)) {
      return res.status(429).json({ error: "Too many login attempts. Please try again in 15 minutes." });
    }

    const user = findUserByUsername(username.trim());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailedLogin(loginKey);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    clearFailedLogin(loginKey);
    const session = createSession(user.id);
    const sessionUser = getSessionUser(session.token);
    setSessionCookie(req, res, session);
    addAudit(user.id, "login", `${user.username} logged in`);
    res.json({ expiresAt: session.expiresAt, user: publicUser(sessionUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  deleteSession(req.token);
  clearSessionCookie(req, res);
  res.status(204).send();
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword = "", newPassword = "" } = req.body;
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

    const fullUser = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
      return res.status(401).json({ error: "Current password is wrong." });
    }

    changePassword(req.user.id, newPassword);
    addAudit(req.user.id, "change_password", `${req.user.username} changed password`);
    const user = getSessionUser(req.token);
    res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireAuth);
app.use("/api", requirePasswordChange);

app.get("/api/users", requireAdmin, (_req, res) => {
  res.json(listUsers());
});

app.post("/api/users", requireAdmin, async (req, res, next) => {
  try {
    const { username, password = "staff123", role = "staff", staffId = null, active = true } = req.body;
    if (!username || !["admin", "staff"].includes(role)) return res.status(400).json({ error: "Username and role are required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const user = createUser({ username, password, role, staffId, active });
    addAudit(req.user.id, "create_user", `Created login ${username}`);
    res.status(201).json(user);
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(400).json({ error: "Username already exists." });
    next(error);
  }
});

app.put("/api/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: "User not found." });
    addAudit(req.user.id, "update_user", `Updated login ${user.username}`);
    res.json(user);
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(400).json({ error: "Username already exists." });
    next(error);
  }
});

app.post("/api/users/:id/reset-password", requireAdmin, async (req, res, next) => {
  try {
    const password = req.body.password || "staff123";
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (!resetUserPassword(req.params.id, password)) return res.status(404).json({ error: "User not found." });
    addAudit(req.user.id, "reset_password", `Reset password for user #${req.params.id}`);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/branding", requireAdmin, async (req, res, next) => {
  try {
    const { businessName, logoDataUrl } = req.body;
    if (businessName !== undefined && String(businessName).trim().length < 2) {
      return res.status(400).json({ error: "Business name is required." });
    }
    if (logoDataUrl && !String(logoDataUrl).startsWith("data:image/")) {
      return res.status(400).json({ error: "Logo must be an image file." });
    }
    if (logoDataUrl && String(logoDataUrl).length > 700000) {
      return res.status(400).json({ error: "Logo image is too large. Use an image under 500KB." });
    }

    res.json(updateBranding({ businessName, logoDataUrl }));
    addAudit(req.user.id, "update_branding", "Updated business branding");
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/opening-hours", (_req, res) => {
  res.json(getOpeningHours());
});

app.put("/api/settings/opening-hours", requireAdmin, async (req, res, next) => {
  try {
    const { openingStart, openingEnd, businessTimezone } = req.body;
    if (!isTime(openingStart) || !isTime(openingEnd)) return res.status(400).json({ error: "Opening hours must be valid times." });
    if (businessTimezone !== undefined && !validTimeZone(businessTimezone)) return res.status(400).json({ error: "Timezone must be valid." });
    const saved = updateOpeningHours({ openingStart, openingEnd, businessTimezone });
    addAudit(req.user.id, "update_opening_hours", `${openingStart}-${openingEnd} ${saved.businessTimezone}`);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

app.get("/api/availability", async (req, res, next) => {
  try {
    const staffId = req.user.role === "admin" ? req.query.staffId : req.user.staffId;
    const rows = staffId
      ? await all("SELECT * FROM availability WHERE staffId = ? ORDER BY weekday ASC", [staffId])
      : await all(
          `SELECT availability.*, staff.name AS staffName
           FROM availability
           JOIN staff ON staff.id = availability.staffId
           ORDER BY staff.name ASC, weekday ASC`
        );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/availability", async (req, res, next) => {
  try {
    const staffId = req.user.role === "admin" ? req.body.staffId : req.user.staffId;
    const { weekday, startTime = "00:00", endTime = "23:59", note = "" } = req.body;
    if (!staffId || weekday === undefined) return res.status(400).json({ error: "Staff and weekday are required." });
    const result = await run(
      "INSERT INTO availability (staffId, weekday, startTime, endTime, note) VALUES (?, ?, ?, ?, ?)",
      [staffId, Number(weekday), startTime, endTime, note]
    );
    addAudit(req.user.id, "add_availability", `Staff #${staffId} unavailable on weekday ${weekday}`);
    res.status(201).json(await get("SELECT * FROM availability WHERE id = ?", [result.id]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/availability/:id", async (req, res, next) => {
  try {
    const row = await get("SELECT * FROM availability WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Availability item not found." });
    if (req.user.role !== "admin" && Number(row.staffId) !== Number(req.user.staffId)) return res.status(403).json({ error: "Not allowed." });
    await run("DELETE FROM availability WHERE id = ?", [req.params.id]);
    addAudit(req.user.id, "delete_availability", `Deleted availability #${req.params.id}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/time-off", async (req, res, next) => {
  try {
    const rows = req.user.role === "admin"
      ? await all(
          `SELECT timeOffRequests.*, staff.name AS staffName
           FROM timeOffRequests
           JOIN staff ON staff.id = timeOffRequests.staffId
           ORDER BY createdAt DESC`
        )
      : await all("SELECT * FROM timeOffRequests WHERE staffId = ? ORDER BY createdAt DESC", [req.user.staffId]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/time-off", async (req, res, next) => {
  try {
    const staffId = req.user.role === "admin" ? req.body.staffId : req.user.staffId;
    const { startDate, endDate, reason = "" } = req.body;
    if (!staffId || !startDate || !endDate) return res.status(400).json({ error: "Staff, start date and end date are required." });
    if (endDate < startDate) return res.status(400).json({ error: "End date cannot be before start date." });
    const result = await run(
      "INSERT INTO timeOffRequests (staffId, startDate, endDate, reason) VALUES (?, ?, ?, ?)",
      [staffId, startDate, endDate, reason]
    );
    addAudit(req.user.id, "request_time_off", `Staff #${staffId} requested ${startDate} to ${endDate}`);
    res.status(201).json(await get("SELECT * FROM timeOffRequests WHERE id = ?", [result.id]));
  } catch (error) {
    next(error);
  }
});

app.put("/api/time-off/:id", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status." });
    await run(
      "UPDATE timeOffRequests SET status = ?, reviewedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [status, req.user.id, req.params.id]
    );
    addAudit(req.user.id, "review_time_off", `Set request #${req.params.id} to ${status}`);
    const row = await get("SELECT * FROM timeOffRequests WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Request not found." });
    notifyStaff(row.staffId, `Time off ${status}`, `Your time-off request for ${row.startDate} to ${row.endDate} was ${status}.`, {
      type: "time_off_reviewed",
      timeOffRequestId: row.id
    });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit", requireAdmin, (_req, res) => {
  res.json(listAudit());
});

app.get("/api/notifications", async (req, res, next) => {
  try {
    const staffFilter = req.user.role === "staff" && req.user.staffId ? "WHERE notifications.staffId = ?" : "";
    const params = req.user.role === "staff" && req.user.staffId ? [req.user.staffId] : [];
    const rows = await all(
      `SELECT notifications.*, staff.name AS staffName
       FROM notifications
       JOIN staff ON staff.id = notifications.staffId
       ${staffFilter}
       ORDER BY notifications.createdAt DESC
       LIMIT 60`,
      params
    );
    res.json(rows.map((row) => ({ ...row, unread: !row.readAt })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/notifications/read-all", async (req, res, next) => {
  try {
    if (req.user.role === "staff" && req.user.staffId) {
      await run("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE staffId = ? AND readAt IS NULL", [req.user.staffId]);
    } else {
      await run("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE readAt IS NULL");
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (_req, res, next) => {
  try {
    const rows = await all(
      `SELECT tasks.*, staff.name AS assignedStaffName, users.username AS createdByUsername
       FROM tasks
       LEFT JOIN staff ON staff.id = tasks.assignedStaffId
       LEFT JOIN users ON users.id = tasks.createdBy
       ORDER BY
         CASE tasks.status
           WHEN 'backlog' THEN 0
           WHEN 'todo' THEN 1
           WHEN 'process' THEN 2
           WHEN 'done' THEN 3
           ELSE 4
         END,
         tasks.updatedAt DESC,
         tasks.id DESC`
    );
    res.json(rows.map(normaliseTask));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const { title = "", description = "", status = "todo", assignedStaffId = null } = req.body;
    const cleanTitle = String(title).trim();
    if (!cleanTitle) return res.status(400).json({ error: "Task title is required." });
    if (!isTaskStatus(status)) return res.status(400).json({ error: "Task status is invalid." });

    const result = await run(
      `INSERT INTO tasks (title, description, status, assignedStaffId, createdBy)
       VALUES (?, ?, ?, ?, ?)`,
      [
        cleanTitle,
        String(description || "").trim(),
        status,
        assignedStaffId || null,
        req.user.id
      ]
    );
    addAudit(req.user.id, "create_task", `Created task ${cleanTitle}`);
    const row = await getTask(result.id);
    res.status(201).json(normaliseTask(row));
  } catch (error) {
    next(error);
  }
});

app.put("/api/tasks/:id", async (req, res, next) => {
  try {
    const current = await getTask(req.params.id);
    if (!current) return res.status(404).json({ error: "Task not found." });

    const nextStatus = req.body.status ?? current.status;
    if (!isTaskStatus(nextStatus)) return res.status(400).json({ error: "Task status is invalid." });

    const nextTitle = req.body.title === undefined ? current.title : String(req.body.title || "").trim();
    if (!nextTitle) return res.status(400).json({ error: "Task title is required." });

    await run(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, assignedStaffId = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextTitle,
        req.body.description === undefined ? current.description || "" : String(req.body.description || "").trim(),
        nextStatus,
        req.body.assignedStaffId === undefined ? current.assignedStaffId : req.body.assignedStaffId || null,
        req.params.id
      ]
    );
    addAudit(req.user.id, "update_task", `Updated task #${req.params.id} to ${nextStatus}`);
    const row = await getTask(req.params.id);
    res.json(normaliseTask(row));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const current = await getTask(req.params.id);
    if (!current) return res.status(404).json({ error: "Task not found." });
    await run("DELETE FROM tasks WHERE id = ?", [req.params.id]);
    addAudit(req.user.id, "delete_task", `Deleted task #${req.params.id}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/push/public-key", (_req, res) => {
  const key = getPushPublicKey();
  res.json({ publicKey: key, enabled: Boolean(key && pushConfigured) });
});

app.get("/api/push/status", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.json({ enabled: false, subscriptions: 0, available: pushConfigured });
    const count = await get("SELECT COUNT(*) AS count FROM pushSubscriptions WHERE staffId = ?", [req.user.staffId]);
    res.json({ enabled: Number(count.count || 0) > 0, subscriptions: Number(count.count || 0), available: pushConfigured });
  } catch (error) {
    next(error);
  }
});

app.post("/api/push/subscribe", async (req, res, next) => {
  try {
    if (!pushConfigured) return res.status(503).json({ error: "Push notifications are not configured." });
    if (!req.user.staffId) return res.status(400).json({ error: "Only staff-linked users can enable push notifications." });

    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: "Invalid push subscription." });

    await run(
      `INSERT INTO pushSubscriptions (staffId, endpoint, p256dh, auth, userAgent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         staffId = excluded.staffId,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         userAgent = excluded.userAgent,
         updatedAt = CURRENT_TIMESTAMP`,
      [req.user.staffId, endpoint, p256dh, auth, req.get("user-agent") || ""]
    );
    addAudit(req.user.id, "enable_push", `${req.user.username} enabled push notifications`);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/push/test", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: "Only staff-linked users can test push notifications." });
    await sendPushToStaff(req.user.staffId, {
      title: "Notifications enabled",
      message: "You will receive rota reminders on this device.",
      type: "push_test"
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/my-feed", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: "Only staff-linked users have a calendar feed." });
    const token = ensureUserCalendarToken(req.user.id);
    const feedUrl = `${getRequestOrigin(req)}/calendar/${token}.ics`;
    res.json({
      feedUrl,
      appleCalendarUrl: `webcal://${feedUrl.replace(/^https?:\/\//, "")}`,
      note: "Use this private URL only for your own calendar app."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/staff", async (_req, res, next) => {
  try {
    const rows = await all("SELECT * FROM staff ORDER BY active DESC, id ASC");
    res.json(rows.map((row) => ({ ...row, active: Boolean(row.active) })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/staff", requireAdmin, async (req, res, next) => {
  try {
    const { name, phone = "", email = "", role, active = true } = req.body;
    if (!name || !role) return res.status(400).json({ error: "Name and role are required." });

    const result = await run(
      "INSERT INTO staff (name, phone, email, role, active) VALUES (?, ?, ?, ?, ?)",
      [name, phone, email, role, active ? 1 : 0]
    );
    createStaffUser(result.id, name);
    const row = await get("SELECT * FROM staff WHERE id = ?", [result.id]);
    addAudit(req.user.id, "create_staff", `Created staff ${name}`);
    res.status(201).json({ ...row, active: Boolean(row.active) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/staff/:id", requireAdmin, async (req, res, next) => {
  try {
    const current = await get("SELECT * FROM staff WHERE id = ?", [req.params.id]);
    if (!current) return res.status(404).json({ error: "Staff member not found." });

    const nextStaff = {
      name: req.body.name ?? current.name,
      phone: req.body.phone ?? current.phone,
      email: req.body.email ?? current.email,
      role: req.body.role ?? current.role,
      active: req.body.active === undefined ? current.active : req.body.active ? 1 : 0
    };

    await run(
      `UPDATE staff
       SET name = ?, phone = ?, email = ?, role = ?, active = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextStaff.name, nextStaff.phone, nextStaff.email, nextStaff.role, nextStaff.active, req.params.id]
    );
    await run("UPDATE users SET active = ?, updatedAt = CURRENT_TIMESTAMP WHERE staffId = ?", [nextStaff.active, req.params.id]);
    const row = await get("SELECT * FROM staff WHERE id = ?", [req.params.id]);
    addAudit(req.user.id, "update_staff", `Updated staff ${row.name}`);
    notifyStaff(row.id, "Staff details updated", "Admin updated your staff profile.", {
      type: "staff_updated"
    });
    res.json({ ...row, active: Boolean(row.active) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/shifts/week", async (req, res, next) => {
  try {
    const startDate = req.query.startDate;
    if (!startDate) return res.status(400).json({ error: "startDate is required." });

    const endDate = addDays(startDate, 6);
    const rows = await all(
      `SELECT shifts.*, staff.name AS staffName, staff.role, staff.active,
              coverStaff.name AS coverForStaffName,
              CASE WHEN timeOffRequests.id IS NULL THEN 0 ELSE 1 END AS approvedTimeOff
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       LEFT JOIN timeOffRequests
         ON timeOffRequests.staffId = shifts.staffId
        AND timeOffRequests.status = 'approved'
        AND timeOffRequests.endDate >= timeOffRequests.startDate
        AND shifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
       WHERE shiftDate BETWEEN ? AND ?
         AND timeOffRequests.id IS NULL
       ORDER BY shiftDate ASC, isExtra ASC, startTime ASC`,
      [startDate, endDate]
    );
    res.json(rows.map(decorateShift));
  } catch (error) {
    next(error);
  }
});

app.get("/api/shifts/my", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.json([]);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await all(
      `SELECT shifts.*, staff.name AS staffName, staff.role, staff.active,
              coverStaff.name AS coverForStaffName
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       WHERE shifts.staffId = ? AND shiftDate >= ?
       ORDER BY shiftDate ASC, startTime ASC
       LIMIT 30`,
      [req.user.staffId, today]
    );
    res.json(rows.map(decorateShift));
  } catch (error) {
    next(error);
  }
});

app.post("/api/shifts/copy-week", requireAdmin, async (req, res, next) => {
  try {
    const { fromStartDate, toStartDate } = req.body;
    if (!fromStartDate || !toStartDate) return res.status(400).json({ error: "From and to week start dates are required." });
    const fromEnd = addDays(fromStartDate, 6);
    const rows = await all("SELECT * FROM shifts WHERE shiftDate BETWEEN ? AND ? ORDER BY shiftDate ASC", [fromStartDate, fromEnd]);
    let copied = 0;
    for (const shift of rows) {
      const dayOffset = daysBetween(fromStartDate, shift.shiftDate);
      const shiftDate = addDays(toStartDate, dayOffset);
      const existing = await get(
        "SELECT id FROM shifts WHERE staffId = ? AND shiftDate = ? AND startTime = ? AND endTime = ?",
        [shift.staffId, shiftDate, shift.startTime, shift.endTime]
      );
      if (existing) continue;
      const copyResult = await run(
        `INSERT INTO shifts
          (staffId, shiftDate, startTime, endTime, breakMinutes, reminderMinutes, reminderTime, notes, isExtra, coverForStaffId, googleCalendarEventId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shift.staffId,
          shiftDate,
          shift.startTime,
          shift.endTime,
          shift.breakMinutes,
          shift.reminderMinutes,
          calculateReminderTime(shiftDate, shift.startTime, shift.reminderMinutes),
          shift.notes,
          shift.isExtra,
          shift.coverForStaffId,
          null
        ]
      );
      notifyStaff(shift.staffId, "Shift copied to next week", `You have a copied shift on ${shiftDate} from ${shift.startTime} to ${shift.endTime}.`, {
        type: "shift_created",
        shiftId: copyResult.id
      });
      copied += 1;
    }
    addAudit(req.user.id, "copy_week", `Copied ${copied} shifts from ${fromStartDate} to ${toStartDate}`);
    res.json({ copied });
  } catch (error) {
    next(error);
  }
});

app.post("/api/shifts", requireAdmin, async (req, res, next) => {
  try {
    const {
      staffId,
      shiftDate,
      startTime,
      endTime,
      breakMinutes = 0,
      reminderMinutes = 30,
      notes = "",
      isExtra = false,
      coverForStaffId = null,
      googleCalendarEventId = null
    } = req.body;
    if (!staffId || !shiftDate || !startTime || !endTime) {
      return res.status(400).json({ error: "staffId, shiftDate, startTime and endTime are required." });
    }

    const result = await run(
      `INSERT INTO shifts
        (staffId, shiftDate, startTime, endTime, breakMinutes, reminderMinutes, reminderTime, notes, isExtra, coverForStaffId, googleCalendarEventId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffId,
        shiftDate,
        startTime,
        endTime,
        Number(breakMinutes),
        Number(reminderMinutes || 30),
        calculateReminderTime(shiftDate, startTime, reminderMinutes),
        notes,
        isExtra ? 1 : 0,
        coverForStaffId || null,
        googleCalendarEventId
      ]
    );
    const row = await getShift(result.id);
    addAudit(req.user.id, "create_shift", `Created shift #${result.id}`);
    notifyStaff(row.staffId, "New shift assigned", `You have a shift on ${row.shiftDate} from ${row.startTime} to ${row.endTime}.`, {
      type: "shift_created",
      shiftId: row.id
    });
    res.status(201).json(decorateShift(row));
  } catch (error) {
    next(error);
  }
});

app.put("/api/shifts/:id", requireAdmin, async (req, res, next) => {
  try {
    const current = await get("SELECT * FROM shifts WHERE id = ?", [req.params.id]);
    if (!current) return res.status(404).json({ error: "Shift not found." });

    const nextShift = {
      staffId: req.body.staffId ?? current.staffId,
      shiftDate: req.body.shiftDate ?? current.shiftDate,
      startTime: req.body.startTime ?? current.startTime,
      endTime: req.body.endTime ?? current.endTime,
      breakMinutes: req.body.breakMinutes ?? current.breakMinutes,
      reminderMinutes: req.body.reminderMinutes ?? current.reminderMinutes,
      notes: req.body.notes ?? current.notes,
      isExtra: req.body.isExtra === undefined ? current.isExtra : req.body.isExtra ? 1 : 0,
      coverForStaffId: req.body.coverForStaffId === undefined ? current.coverForStaffId : req.body.coverForStaffId || null,
      googleCalendarEventId: req.body.googleCalendarEventId ?? current.googleCalendarEventId
    };
    const previousNotes = String(current.notes || "").trim();
    const nextNotes = String(nextShift.notes || "").trim();
    const notesChanged = previousNotes !== nextNotes;
    const reminderChanged =
      Number(current.staffId) !== Number(nextShift.staffId) ||
      current.shiftDate !== nextShift.shiftDate ||
      current.startTime !== nextShift.startTime ||
      Number(current.reminderMinutes) !== Number(nextShift.reminderMinutes);
    const rotaChanged =
      Number(current.staffId) !== Number(nextShift.staffId) ||
      current.shiftDate !== nextShift.shiftDate ||
      current.startTime !== nextShift.startTime ||
      current.endTime !== nextShift.endTime ||
      Number(current.breakMinutes) !== Number(nextShift.breakMinutes) ||
      Number(current.reminderMinutes) !== Number(nextShift.reminderMinutes) ||
      Number(current.isExtra || 0) !== Number(nextShift.isExtra || 0) ||
      Number(current.coverForStaffId || 0) !== Number(nextShift.coverForStaffId || 0);

    await run(
      `UPDATE shifts
       SET staffId = ?, shiftDate = ?, startTime = ?, endTime = ?, breakMinutes = ?,
           reminderMinutes = ?, reminderTime = ?, notes = ?, isExtra = ?, coverForStaffId = ?, googleCalendarEventId = ?,
           reminderSentAt = ?, startReminderSentAt = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextShift.staffId,
        nextShift.shiftDate,
        nextShift.startTime,
        nextShift.endTime,
        Number(nextShift.breakMinutes),
        Number(nextShift.reminderMinutes),
        calculateReminderTime(nextShift.shiftDate, nextShift.startTime, nextShift.reminderMinutes),
        nextShift.notes,
        nextShift.isExtra,
        nextShift.coverForStaffId,
        nextShift.googleCalendarEventId,
        reminderChanged ? null : current.reminderSentAt,
        reminderChanged ? null : current.startReminderSentAt,
        req.params.id
      ]
    );
    const row = await getShift(req.params.id);
    addAudit(req.user.id, "update_shift", `Updated shift #${req.params.id}`);
    if (notesChanged && nextNotes) {
      notifyStaff(row.staffId, previousNotes ? "Shift note updated" : "Shift note added", `Note for ${row.shiftDate} ${row.startTime}-${row.endTime}: ${nextNotes}`, {
        type: "shift_note",
        shiftId: row.id
      });
    }
    if (rotaChanged) {
      notifyStaff(row.staffId, "Shift updated", `Your shift on ${row.shiftDate} is now ${row.startTime} to ${row.endTime}.`, {
        type: "shift_updated",
        shiftId: row.id
      });
    }
    if (Number(current.staffId) !== Number(row.staffId)) {
      notifyStaff(current.staffId, "Shift reassigned", `Your shift on ${current.shiftDate} from ${current.startTime} to ${current.endTime} was reassigned.`, {
        type: "shift_reassigned",
        shiftId: row.id
      });
    }
    res.json(decorateShift(row));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/shifts/:id", requireAdmin, async (req, res, next) => {
  try {
    const current = await getShift(req.params.id);
    const result = await run("DELETE FROM shifts WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: "Shift not found." });
    addAudit(req.user.id, "delete_shift", `Deleted shift #${req.params.id}`);
    if (current) {
      notifyStaff(current.staffId, "Shift removed", `Your shift on ${current.shiftDate} from ${current.startTime} to ${current.endTime} was removed.`, {
        type: "shift_deleted"
      });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/reminders/upcoming", async (req, res, next) => {
  try {
    const now = new Date();
    const today = datePartsInBusinessTimeZone(now).date;
    const staffFilter = req.user.role === "staff" && req.user.staffId ? "AND staff.id = ?" : "";
    const params = req.user.role === "staff" && req.user.staffId ? [today, req.user.staffId] : [today];
    const rows = await all(
      `SELECT shifts.*, staff.name AS staffName, staff.phone, staff.role,
              coverStaff.name AS coverForStaffName
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       WHERE staff.active = 1 AND shifts.shiftDate >= ?
       ${staffFilter}
       ORDER BY shifts.shiftDate ASC, shifts.startTime ASC
       LIMIT 80`,
      params
    );
    res.json(
      rows
        .map(decorateShift)
        .filter((shift) => shiftStartInstant(shift.shiftDate, shift.startTime) >= now)
        .slice(0, 20)
    );
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    if (req.path === "/health") return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" ? { message: error.message } : {})
  });
});

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const cookieToken = parseCookies(req).fuelops_session || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const token = cookieToken || bearerToken;
  const user = getSessionUser(token);

  if (!user) return res.status(401).json({ error: "Please log in." });

  req.token = token;
  req.user = user;
  next();
}

function requirePasswordChange(req, res, next) {
  if (!req.user?.mustChangePassword) return next();
  res.status(403).json({ error: "Please change your temporary password before using the rota." });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access is required." });
  next();
}

initDb().then(() => {
  configurePushNotifications();
  app.listen(PORT, () => {
    console.log(`FuelOps Rota Backend running on port ${PORT}`);
  });
  startReminderPushScheduler();
});

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function isTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function getShift(id) {
  return get(
    `SELECT shifts.*, staff.name AS staffName, staff.role, staff.active,
            coverStaff.name AS coverForStaffName
     FROM shifts
     JOIN staff ON staff.id = shifts.staffId
     LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
     WHERE shifts.id = ?`,
    [id]
  );
}

function notifyStaff(staffId, title, message, { type = "rota_update", shiftId = null, timeOffRequestId = null } = {}) {
  if (!staffId) return;
  run(
    `INSERT INTO notifications (staffId, type, title, message, shiftId, timeOffRequestId)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [staffId, type, title, message, shiftId, timeOffRequestId]
  );
  sendPushToStaff(staffId, { title, message, type, shiftId, timeOffRequestId }).catch((error) => {
    console.error("Push notification failed", error);
  });
}

function configurePushNotifications() {
  const keys = getOrCreateVapidKeys();
  if (!keys?.publicKey || !keys?.privateKey) {
    pushConfigured = false;
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    keys.publicKey,
    keys.privateKey
  );
  pushConfigured = true;
}

function getOrCreateVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  }

  const publicRow = get("SELECT value FROM settings WHERE key = ?", ["vapidPublicKey"]);
  const privateRow = get("SELECT value FROM settings WHERE key = ?", ["vapidPrivateKey"]);
  if (publicRow?.value && privateRow?.value) {
    return { publicKey: publicRow.value, privateKey: privateRow.value };
  }

  const generated = webpush.generateVAPIDKeys();
  run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["vapidPublicKey", generated.publicKey]
  );
  run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["vapidPrivateKey", generated.privateKey]
  );
  return generated;
}

function getPushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || get("SELECT value FROM settings WHERE key = ?", ["vapidPublicKey"])?.value || "";
}

async function sendPushToStaff(staffId, { title, message, type = "rota_update", shiftId = null, timeOffRequestId = null } = {}) {
  if (!pushConfigured || !staffId) return;
  const subscriptions = await all("SELECT * FROM pushSubscriptions WHERE staffId = ?", [staffId]);
  const payload = JSON.stringify({
    title: title || "Rota notification",
    body: message || "You have a rota update.",
    type,
    shiftId,
    timeOffRequestId,
    tag: shiftId ? `${type}:${shiftId}` : type,
    url: "/"
  });

  await Promise.all(subscriptions.map(async (row) => {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth
      }
    };

    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await run("DELETE FROM pushSubscriptions WHERE id = ?", [row.id]);
        return;
      }
      console.error("Push send failed", error.statusCode || "", error.message);
    }
  }));
}

function startReminderPushScheduler() {
  processDueShiftNotifications().catch((error) => console.error("Reminder push check failed", error));
  setInterval(() => {
    processDueShiftNotifications().catch((error) => console.error("Reminder push check failed", error));
  }, 60 * 1000);
}

async function processDueShiftNotifications() {
  if (!pushConfigured) return;
  await processDueReminderPushes();
  await processDueStartPushes();
}

async function processDueReminderPushes() {
  const now = new Date().toISOString();
  const nowDate = new Date(now);
  const today = now.slice(0, 10);
  const due = await all(
    `SELECT shifts.*, staff.name AS staffName, staff.active,
            coverStaff.name AS coverForStaffName
     FROM shifts
     JOIN staff ON staff.id = shifts.staffId
     LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
     LEFT JOIN timeOffRequests
       ON timeOffRequests.staffId = shifts.staffId
      AND timeOffRequests.status = 'approved'
      AND timeOffRequests.endDate >= timeOffRequests.startDate
      AND shifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
     WHERE staff.active = 1
       AND shifts.reminderSentAt IS NULL
       AND shifts.reminderTime <= ?
       AND shifts.shiftDate >= ?
       AND timeOffRequests.id IS NULL
     ORDER BY shifts.reminderTime ASC
     LIMIT 25`,
    [now, today]
  );

  for (const shift of due) {
    const decorated = decorateShift(shift);
    const startDate = shiftStartDate(decorated);
    if (startDate <= nowDate) {
      await run("UPDATE shifts SET reminderSentAt = ? WHERE id = ?", [now, decorated.id]);
      continue;
    }
    const coverText = decorated.isExtra && decorated.coverForStaffName ? ` Extra cover for ${decorated.coverForStaffName}.` : "";
    const noteText = decorated.notes ? ` Note: ${decorated.notes}.` : "";
    const message = `${decorated.reminderMessage}.${coverText}${noteText}`;
    notifyStaff(decorated.staffId, "Shift starts soon", message, {
      type: "shift_reminder",
      shiftId: decorated.id
    });
    await run("UPDATE shifts SET reminderSentAt = ? WHERE id = ?", [now, decorated.id]);
  }
}

async function processDueStartPushes() {
  const now = new Date().toISOString();
  const nowDate = new Date(now);
  const today = now.slice(0, 10);
  const due = await all(
    `SELECT shifts.*, staff.name AS staffName, staff.active,
            coverStaff.name AS coverForStaffName
     FROM shifts
     JOIN staff ON staff.id = shifts.staffId
     LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
     LEFT JOIN timeOffRequests
       ON timeOffRequests.staffId = shifts.staffId
      AND timeOffRequests.status = 'approved'
      AND timeOffRequests.endDate >= timeOffRequests.startDate
      AND shifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
     WHERE staff.active = 1
       AND shifts.startReminderSentAt IS NULL
       AND shifts.shiftDate >= ?
       AND timeOffRequests.id IS NULL
     ORDER BY shifts.shiftDate ASC, shifts.startTime ASC
     LIMIT 40`,
    [today]
  );

  for (const shift of due) {
    const decorated = decorateShift(shift);
    const startDate = shiftStartDate(decorated);
    if (startDate > nowDate) continue;

    const coverText = decorated.isExtra && decorated.coverForStaffName ? ` Extra cover for ${decorated.coverForStaffName}.` : "";
    const noteText = decorated.notes ? ` Note: ${decorated.notes}.` : "";
    const message = `Your shift starts now at ${decorated.startTime}.${coverText}${noteText}`;
    notifyStaff(decorated.staffId, "Shift starting now", message, {
      type: "shift_start",
      shiftId: decorated.id
    });
    await run("UPDATE shifts SET startReminderSentAt = ? WHERE id = ?", [now, decorated.id]);
  }
}

function shiftStartDate(shift) {
  return shiftStartInstant(shift.shiftDate, shift.startTime);
}

async function getTask(id) {
  return get(
    `SELECT tasks.*, staff.name AS assignedStaffName, users.username AS createdByUsername
     FROM tasks
     LEFT JOIN staff ON staff.id = tasks.assignedStaffId
     LEFT JOIN users ON users.id = tasks.createdBy
     WHERE tasks.id = ?`,
    [id]
  );
}

function normaliseTask(row) {
  if (!row) return row;
  return {
    ...row,
    assignedStaffId: row.assignedStaffId || null,
    createdBy: row.createdBy || null
  };
}

function isTaskStatus(status) {
  return ["backlog", "todo", "process", "done"].includes(status);
}

function datePartsInBusinessTimeZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: getBusinessTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type) => parts.find((item) => item.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`
  };
}

function buildIcsCalendar({ name, shifts }) {
  const timeZone = getBusinessTimezone();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FuelOps Rota//Rota Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escapeIcsText(name),
    `X-WR-TIMEZONE:${timeZone}`,
    "X-PUBLISHED-TTL:PT30M"
  ];

  for (const shift of shifts) {
    lines.push(...buildShiftEvent(shift, timeZone));
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function buildShiftEvent(shift, timeZone = getBusinessTimezone()) {
  const endDate = shift.endTime <= shift.startTime ? addDays(shift.shiftDate, 1) : shift.shiftDate;
  const summary = shift.isExtra
    ? `Extra shift - ${shift.staffName}`
    : `Shift - ${shift.staffName}`;
  const description = [
    shift.isExtra && shift.coverForStaffName ? `Extra cover for ${shift.coverForStaffName}` : "",
    shift.notes ? `Note: ${shift.notes}` : "",
    `Hours: ${shift.totalHours}`
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:fuelops-shift-${shift.id}@fuelops-rota`,
    `DTSTAMP:${toUtcIcsDate(new Date())}`,
    `DTSTART;TZID=${timeZone}:${toLocalIcsDateTime(shift.shiftDate, shift.startTime)}`,
    `DTEND;TZID=${timeZone}:${toLocalIcsDateTime(endDate, shift.endTime)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "BEGIN:VALARM",
    `TRIGGER:-PT${Math.max(Number(shift.reminderMinutes || 30), 0)}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(shift.reminderMessage || "Your shift starts soon")}`,
    "END:VALARM",
    "END:VEVENT"
  ];
}

function toLocalIcsDateTime(dateString, timeString) {
  return `${dateString.replaceAll("-", "")}T${String(timeString || "00:00").replace(":", "")}00`;
}

function toUtcIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function safeFilename(value) {
  return String(value || "rota").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rota";
}

function getRequestOrigin(req) {
  const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function parseCookies(req) {
  const header = req.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function setSessionCookie(req, res, session) {
  const secure = isSecureRequest(req);
  const maxAgeSeconds = Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
  const parts = [
    `fuelops_session=${encodeURIComponent(session.token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "SameSite=None" : "SameSite=Lax"
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  const secure = isSecureRequest(req);
  const parts = [
    "fuelops_session=",
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    secure ? "SameSite=None" : "SameSite=Lax"
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function isSecureRequest(req) {
  return req.secure || req.get("x-forwarded-proto") === "https";
}

function getLoginRateKey(req, username) {
  const forwarded = req.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}:${String(username || "").trim().toLowerCase()}`;
}

function isRateLimited(key) {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (Date.now() - record.firstAttemptAt > loginWindowMs) {
    loginAttempts.delete(key);
    return false;
  }
  return record.count >= maxLoginAttempts;
}

function recordFailedLogin(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.firstAttemptAt > loginWindowMs) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    return;
  }
  record.count += 1;
}

function clearFailedLogin(key) {
  loginAttempts.delete(key);
}
