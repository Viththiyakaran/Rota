import cors from "cors";
import express from "express";
import crypto from "node:crypto";
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
  getGasStockConfig,
  getOpeningHours,
  getSessionUser,
  getUkRotaRules,
  hashPassword,
  initDb,
  listAudit,
  listUsers,
  publicUser,
  run,
  resetUserPassword,
  shiftStartInstant,
  updateOpeningHours,
  updateGasStockConfig,
  updateUkRotaRules,
  updateUser,
  updateBranding,
  validTimeZone,
  verifyPassword
} from "./db.js";

const app = express();
const PORT = process.env.PORT || 5000;
const appVersion = "1.0.1";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const taskArchiveAfterMs = 24 * 60 * 60 * 1000;
let pushConfigured = false;
const configuredFrontendUrls = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URLS,
  process.env.CORS_ORIGIN,
  process.env.NETLIFY_FRONTEND_URL
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(","))
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "https://marvelous-tarsier-71e4a4.netlify.app",
  ...configuredFrontendUrls
].filter(Boolean);

app.set("trust proxy", 1);
app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = origin ? String(origin).replace(/\/$/, "") : "";
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  const wantsHtml = String(req.get("accept") || "").includes("text/html");
  if (wantsHtml && fs.existsSync(frontendDist)) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }

  res.json({
    app: "LocalPlanner Backend",
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
    app: "LocalPlanner Backend",
    version: appVersion,
    authMigration: 3
  });
});

app.get("/api", (_req, res) => {
  res.json({
    app: "LocalPlanner Backend",
    version: appVersion,
    endpoints: [
      "GET /",
      "GET /health",
      "GET /api",
      "GET /api/health",
      "GET /api/settings/branding",
      "GET /api/settings/uk-rules",
      "PUT /api/settings/uk-rules",
      "GET /api/settings/gas-stock",
      "PUT /api/settings/gas-stock",
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
      "GET /api/shifts/publication?startDate=yyyy-mm-dd",
      "POST /api/shifts/publish",
      "POST /api/shifts/copy-week",
      "POST /api/rota-patterns/generate",
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
      "POST /api/notifications/:id/read",
      "GET /api/attendance/status",
      "GET /api/attendance",
      "POST /api/attendance/clock-in",
      "POST /api/attendance/clock-out",
      "GET /api/time-off",
      "POST /api/time-off",
      "PUT /api/time-off/:id",
      "GET /api/availability",
      "POST /api/availability",
      "DELETE /api/availability/:id",
      "GET /api/tasks",
      "GET /api/tasks/completed",
      "POST /api/tasks",
      "PUT /api/tasks/:id",
      "DELETE /api/tasks/:id",
      "GET /api/work-schedules",
      "POST /api/work-schedules",
      "PUT /api/work-schedules/:id",
      "DELETE /api/work-schedules/:id",
      "GET /api/work-orders/:taskId",
      "GET /api/work-orders/summary?weekStart=yyyy-mm-dd",
      "PUT /api/work-orders/:taskId/draft",
      "POST /api/work-orders/:taskId/submit",
      "GET /api/gas-stock/current?weekStart=yyyy-mm-dd",
      "PUT /api/gas-stock/draft",
      "POST /api/gas-stock/submit",
      "GET /api/sales?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd",
      "PUT /api/sales",
      "GET /api/sales/communication?weekStart=yyyy-mm-dd",
      "PUT /api/sales/communication",
      "GET /api/audit"
    ]
  });
});

app.get("/api/settings/branding", async (_req, res, next) => {
  try {
    res.json(await getBranding());
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/uk-rules", requireAuth, async (_req, res, next) => {
  try {
    res.json(await getUkRotaRules());
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/uk-rules", requireAuth, requirePasswordChange, requireAdmin, async (req, res, next) => {
  try {
    const saved = await updateUkRotaRules(req.body);
    await addAudit(req.user.id, "update_uk_rota_rules", "Updated UK rota warning settings");
    res.json(saved);
  } catch (error) {
    next(error);
  }
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
      `SELECT publishedShifts.sourceShiftId AS id, publishedShifts.*, staff.name AS staffName, staff.role, staff.active,
              coverStaff.name AS coverForStaffName
       FROM publishedShifts
       JOIN staff ON staff.id = publishedShifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = publishedShifts.coverForStaffId
       LEFT JOIN timeOffRequests
         ON timeOffRequests.staffId = publishedShifts.staffId
        AND timeOffRequests.status = 'approved'
        AND timeOffRequests.endDate >= timeOffRequests.startDate
        AND publishedShifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
       WHERE publishedShifts.staffId = ?
         AND publishedShifts.shiftDate BETWEEN ? AND ?
         AND timeOffRequests.id IS NULL
       ORDER BY publishedShifts.shiftDate ASC, publishedShifts.startTime ASC`,
      [user.staffId, today, until]
    );

    const branding = await getBranding();
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

    const user = await findUserByUsername(String(username).trim());
    if (!user || user.role !== "admin") return res.status(404).json({ error: "Admin user not found." });

    await resetUserPassword(user.id, newPassword);
    await addAudit(user.id, "recover_admin_password", `Recovered admin login ${user.username}`);
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

    const user = await findUserByUsername(username.trim());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailedLogin(loginKey);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    clearFailedLogin(loginKey);
    const session = await createSession(user.id);
    const sessionUser = await getSessionUser(session.token);
    setSessionCookie(req, res, session);
    await addAudit(user.id, "login", `${user.username} logged in`);
    res.json({ expiresAt: session.expiresAt, user: publicUser(sessionUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res, next) => {
  try {
    await deleteSession(req.token);
    clearSessionCookie(req, res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword = "", newPassword = "" } = req.body;
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

    const fullUser = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
      return res.status(401).json({ error: "Current password is wrong." });
    }

    await changePassword(req.user.id, newPassword);
    await addAudit(req.user.id, "change_password", `${req.user.username} changed password`);
    const user = await getSessionUser(req.token);
    res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireAuth);
app.use("/api", requirePasswordChange);

app.get("/api/users", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", requireAdmin, async (req, res, next) => {
  try {
    const { username, password = "staff123", role = "staff", staffId = null, active = true } = req.body;
    if (!username || !["admin", "staff"].includes(role)) return res.status(400).json({ error: "Username and role are required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const user = await createUser({ username, password, role, staffId, active });
    await addAudit(req.user.id, "create_user", `Created login ${username}`);
    res.status(201).json(user);
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(400).json({ error: "Username already exists." });
    next(error);
  }
});

app.put("/api/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: "User not found." });
    await addAudit(req.user.id, "update_user", `Updated login ${user.username}`);
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
    if (!await resetUserPassword(req.params.id, password)) return res.status(404).json({ error: "User not found." });
    await addAudit(req.user.id, "reset_password", `Reset password for user #${req.params.id}`);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/branding", requireAdmin, async (req, res, next) => {
  try {
    const { businessName, logoDataUrl, performanceTrackerEnabled } = req.body;
    if (businessName !== undefined && String(businessName).trim().length < 2) {
      return res.status(400).json({ error: "Business name is required." });
    }
    if (logoDataUrl && !String(logoDataUrl).startsWith("data:image/")) {
      return res.status(400).json({ error: "Logo must be an image file." });
    }
    if (logoDataUrl && String(logoDataUrl).length > 700000) {
      return res.status(400).json({ error: "Logo image is too large. Use an image under 500KB." });
    }

    res.json(await updateBranding({ businessName, logoDataUrl, performanceTrackerEnabled }));
    await addAudit(req.user.id, "update_branding", "Updated business branding and features");
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/opening-hours", async (_req, res, next) => {
  try {
    res.json(await getOpeningHours());
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/opening-hours", requireAdmin, async (req, res, next) => {
  try {
    const { openingStart, openingEnd, businessTimezone, shiftRangePresets } = req.body;
    if (!isTime(openingStart) || !isTime(openingEnd)) return res.status(400).json({ error: "Opening hours must be valid times." });
    if (businessTimezone !== undefined && !validTimeZone(businessTimezone)) return res.status(400).json({ error: "Timezone must be valid." });
    const saved = await updateOpeningHours({ openingStart, openingEnd, businessTimezone, shiftRangePresets });
    await addAudit(req.user.id, "update_opening_hours", `${openingStart}-${openingEnd} ${saved.businessTimezone} with ${saved.shiftRangePresets.length} shift ranges`);
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
    await addAudit(req.user.id, "add_availability", `Staff #${staffId} unavailable on weekday ${weekday}`);
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
    await addAudit(req.user.id, "delete_availability", `Deleted availability #${req.params.id}`);
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
    await addAudit(req.user.id, "request_time_off", `Staff #${staffId} requested ${startDate} to ${endDate}`);
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
    await addAudit(req.user.id, "review_time_off", `Set request #${req.params.id} to ${status}`);
    const row = await get("SELECT * FROM timeOffRequests WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Request not found." });
    await notifyStaff(row.staffId, `Time off ${status}`, `Your time-off request for ${row.startDate} to ${row.endDate} was ${status}.`, {
      type: "time_off_reviewed",
      timeOffRequestId: row.id
    });
    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await listAudit());
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/gas-stock", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await getGasStockConfig());
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings/gas-stock", requireAdmin, async (req, res, next) => {
  try {
    const assigneeId = normaliseTaskAssigneeId(req.body.assignedStaffId);
    if (Number.isNaN(assigneeId)) return res.status(400).json({ error: "Gas stock assignee is invalid." });
    if (assigneeId && !(await activeStaffExists(assigneeId))) {
      return res.status(400).json({ error: "Gas stock assignee is not an active staff member." });
    }
    const saved = await updateGasStockConfig({ ...req.body, assignedStaffId: assigneeId });
    await ensureWeeklyGasStockTask(saved);
    await addAudit(req.user.id, "update_gas_stock_settings", "Updated weekly gas stock settings");
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

app.get("/api/sales", requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) {
      return res.status(400).json({ error: "A valid sales date range is required." });
    }
    const rows = await all(
      `SELECT id, saleDate, amount, createdAt, updatedAt
       FROM salesEntries
       WHERE saleDate >= ? AND saleDate <= ?
       ORDER BY saleDate ASC`,
      [startDate, endDate]
    );
    res.json(rows.map((row) => ({ ...row, amount: Number(row.amount || 0) })));
  } catch (error) {
    next(error);
  }
});

app.put("/api/sales", requireAdmin, async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (entries.length === 0 || entries.length > 31) {
      return res.status(400).json({ error: "Add between 1 and 31 daily sales entries." });
    }

    const seenDates = new Set();
    for (const entry of entries) {
      const saleDate = String(entry.saleDate || "");
      if (!isDate(saleDate) || seenDates.has(saleDate)) {
        return res.status(400).json({ error: "Each sales date must be valid and unique." });
      }
      seenDates.add(saleDate);
      if (entry.amount !== null && entry.amount !== "") {
        const amount = Number(entry.amount);
        if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) {
          return res.status(400).json({ error: "Sales amounts must be between £0 and £100,000,000." });
        }
      }
    }

    for (const entry of entries) {
      const saleDate = String(entry.saleDate);
      if (entry.amount === null || entry.amount === "") {
        await run("DELETE FROM salesEntries WHERE saleDate = ?", [saleDate]);
      } else {
        await run(
          `INSERT INTO salesEntries (saleDate, amount, createdBy)
           VALUES (?, ?, ?)
           ON CONFLICT(saleDate) DO UPDATE SET
             amount = excluded.amount,
             createdBy = excluded.createdBy,
             updatedAt = CURRENT_TIMESTAMP`,
          [saleDate, Number(entry.amount), req.user.id]
        );
      }
    }

    const dates = Array.from(seenDates).sort();
    await addAudit(req.user.id, "update_sales", `Updated daily sales for ${dates[0]} to ${dates[dates.length - 1]}`);
    const saved = await all(
      `SELECT id, saleDate, amount, createdAt, updatedAt
       FROM salesEntries
       WHERE saleDate >= ? AND saleDate <= ?
       ORDER BY saleDate ASC`,
      [dates[0], dates[dates.length - 1]]
    );
    res.json(saved.map((row) => ({ ...row, amount: Number(row.amount || 0) })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/sales/communication", requireAdmin, async (req, res, next) => {
  try {
    const weekStart = String(req.query.weekStart || "");
    if (!isDate(weekStart)) return res.status(400).json({ error: "A valid week start date is required." });
    const row = await get(
      "SELECT weekStart, communication, updatedAt FROM salesWeeklyNotes WHERE weekStart = ?",
      [weekStart]
    );
    res.json(row || { weekStart, communication: "", updatedAt: null });
  } catch (error) {
    next(error);
  }
});

app.put("/api/sales/communication", requireAdmin, async (req, res, next) => {
  try {
    const weekStart = String(req.body.weekStart || "");
    const communication = String(req.body.communication || "").trim();
    if (!isDate(weekStart)) return res.status(400).json({ error: "A valid week start date is required." });
    if (communication.length > 2000) return res.status(400).json({ error: "Communication must be 2,000 characters or fewer." });

    if (communication) {
      await run(
        `INSERT INTO salesWeeklyNotes (weekStart, communication, createdBy)
         VALUES (?, ?, ?)
         ON CONFLICT(weekStart) DO UPDATE SET
           communication = excluded.communication,
           createdBy = excluded.createdBy,
           updatedAt = CURRENT_TIMESTAMP`,
        [weekStart, communication, req.user.id]
      );
    } else {
      await run("DELETE FROM salesWeeklyNotes WHERE weekStart = ?", [weekStart]);
    }

    await addAudit(req.user.id, "update_sales_communication", `Updated performance tracker communication for week ${weekStart}`);
    const row = await get(
      "SELECT weekStart, communication, updatedAt FROM salesWeeklyNotes WHERE weekStart = ?",
      [weekStart]
    );
    res.json(row || { weekStart, communication: "", updatedAt: null });
  } catch (error) {
    next(error);
  }
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

app.get("/api/attendance/status", async (req, res, next) => {
  try {
    const rules = await getUkRotaRules();
    const staffId = req.user.role === "admin" ? Number(req.query.staffId || req.user.staffId || 0) : Number(req.user.staffId || 0);
    if (!staffId) {
      return res.json({ rules, enabled: Boolean(rules.clockInEnabled), openEntry: null, recentEntries: [] });
    }

    const openEntry = await getAttendanceOpenEntry(staffId);
    const recentEntries = await listAttendanceEntries({ staffId, limit: 5 });
    res.json({
      rules,
      enabled: Boolean(rules.clockInEnabled),
      locationRequired: Boolean(rules.clockInEnabled && rules.locationCheckEnabled),
      openEntry: normaliseAttendance(openEntry),
      recentEntries: recentEntries.map(normaliseAttendance)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/attendance", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await listAttendanceEntries({ limit: 80 });
    res.json(rows.map(normaliseAttendance));
  } catch (error) {
    next(error);
  }
});

app.post("/api/attendance/clock-in", async (req, res, next) => {
  try {
    const rules = await getUkRotaRules();
    if (!rules.clockInEnabled) return res.status(403).json({ error: "Clock In / Out is not enabled." });
    if (!req.user.staffId) return res.status(400).json({ error: "This login is not linked to a staff profile." });

    const location = readAttendanceLocation(req.body, Boolean(rules.locationCheckEnabled), "clock in");
    const openEntry = await getAttendanceOpenEntry(req.user.staffId);
    if (openEntry) return res.status(400).json({ error: "You are already clocked in." });

    const shiftId = req.body.shiftId ? Number(req.body.shiftId) : null;
    if (shiftId) {
      const shift = await get("SELECT id, staffId FROM shifts WHERE id = ?", [shiftId]);
      if (!shift || Number(shift.staffId) !== Number(req.user.staffId)) {
        return res.status(400).json({ error: "Choose one of your own shifts to clock in." });
      }
    }

    const now = new Date().toISOString();
    const result = await run(
      `INSERT INTO attendance
        (staffId, shiftId, clockInAt, clockInLatitude, clockInLongitude, clockInLocationAccuracy, clockInLocationChecked)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.staffId,
        shiftId,
        now,
        location.latitude,
        location.longitude,
        location.accuracy,
        location.checked ? 1 : 0
      ]
    );
    await addAudit(req.user.id, "clock_in", `${req.user.staffName || req.user.username} clocked in`);
    const row = await getAttendanceEntry(result.id);
    res.status(201).json(normaliseAttendance(row));
  } catch (error) {
    next(error);
  }
});

app.post("/api/attendance/clock-out", async (req, res, next) => {
  try {
    const rules = await getUkRotaRules();
    if (!rules.clockInEnabled) return res.status(403).json({ error: "Clock In / Out is not enabled." });
    if (!req.user.staffId) return res.status(400).json({ error: "This login is not linked to a staff profile." });

    const openEntry = await getAttendanceOpenEntry(req.user.staffId);
    if (!openEntry) return res.status(400).json({ error: "You are not clocked in." });
    const location = readAttendanceLocation(req.body, Boolean(rules.locationCheckEnabled), "clock out");
    const now = new Date().toISOString();

    await run(
      `UPDATE attendance
       SET clockOutAt = ?,
           clockOutLatitude = ?,
           clockOutLongitude = ?,
           clockOutLocationAccuracy = ?,
           clockOutLocationChecked = ?,
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        now,
        location.latitude,
        location.longitude,
        location.accuracy,
        location.checked ? 1 : 0,
        openEntry.id
      ]
    );
    await addAudit(req.user.id, "clock_out", `${req.user.staffName || req.user.username} clocked out`);
    const row = await getAttendanceEntry(openEntry.id);
    res.json(normaliseAttendance(row));
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (_req, res, next) => {
  try {
    await ensureWeeklyGasStockTask();
    await ensureRecurringWorkTasks();
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
         COALESCE(tasks.dueDate, '9999-12-31') ASC,
         tasks.updatedAt DESC,
         tasks.id DESC`
    );
    res.json(rows.map(normaliseTask).filter((task) => !task.archived));
  } catch (error) {
    next(error);
  }
});

app.get("/api/work-schedules", async (_req, res, next) => {
  try {
    await ensureRecurringWorkTasks();
    const rows = await all(
      `SELECT workSchedules.*, staff.name AS assignedStaffName
       FROM workSchedules
       LEFT JOIN staff ON staff.id = workSchedules.assignedStaffId
       ORDER BY workSchedules.active DESC, workSchedules.name ASC, workSchedules.id ASC`
    );
    res.json(rows.map(normaliseWorkSchedule));
  } catch (error) {
    next(error);
  }
});

app.post("/api/work-schedules", requireAdmin, async (req, res, next) => {
  try {
    const schedule = await validateWorkSchedule(req.body);
    const result = await run(
      `INSERT INTO workSchedules (name, category, supplier, weekdays, departments, notes, active, assignedStaffId, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.name,
        schedule.category,
        schedule.supplier,
        JSON.stringify(schedule.weekdays),
        JSON.stringify(schedule.departments),
        schedule.notes,
        schedule.active ? 1 : 0,
        schedule.assignedStaffId,
        req.user.id
      ]
    );
    await ensureRecurringWorkTasks();
    await addAudit(req.user.id, "create_work_schedule", `Created ${schedule.name} order plan`);
    res.status(201).json(normaliseWorkSchedule(await getWorkSchedule(result.id)));
  } catch (error) {
    next(error);
  }
});

app.put("/api/work-schedules/:id", requireAdmin, async (req, res, next) => {
  try {
    const current = await getWorkSchedule(req.params.id);
    if (!current) return res.status(404).json({ error: "Order plan not found." });
    const schedule = await validateWorkSchedule({ ...normaliseWorkSchedule(current), ...req.body });
    await run(
      `UPDATE workSchedules
       SET name = ?, category = ?, supplier = ?, weekdays = ?, departments = ?, notes = ?, active = ?, assignedStaffId = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        schedule.name,
        schedule.category,
        schedule.supplier,
        JSON.stringify(schedule.weekdays),
        JSON.stringify(schedule.departments),
        schedule.notes,
        schedule.active ? 1 : 0,
        schedule.assignedStaffId,
        req.params.id
      ]
    );
    const today = datePartsInBusinessTimeZone().date;
    await run(
      `DELETE FROM workOrderSubmissions
       WHERE taskId IN (
         SELECT id FROM tasks
         WHERE taskType = 'recurring_order' AND linkedRecordId = ? AND status != 'done' AND dueDate >= ?
       )`,
      [req.params.id, mondayForDate(today)]
    );
    await run(
      `DELETE FROM tasks
       WHERE taskType = 'recurring_order' AND linkedRecordId = ? AND status != 'done' AND dueDate >= ?`,
      [req.params.id, mondayForDate(today)]
    );
    await ensureRecurringWorkTasks();
    await addAudit(req.user.id, "update_work_schedule", `Updated ${schedule.name} order plan`);
    res.json(normaliseWorkSchedule(await getWorkSchedule(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/work-schedules/:id", requireAdmin, async (req, res, next) => {
  try {
    const current = await getWorkSchedule(req.params.id);
    if (!current) return res.status(404).json({ error: "Order plan not found." });
    await run(
      `DELETE FROM workOrderSubmissions
       WHERE taskId IN (SELECT id FROM tasks WHERE taskType = 'recurring_order' AND linkedRecordId = ? AND status != 'done')`,
      [req.params.id]
    );
    await run("DELETE FROM tasks WHERE taskType = 'recurring_order' AND linkedRecordId = ? AND status != 'done'", [req.params.id]);
    await run("DELETE FROM workSchedules WHERE id = ?", [req.params.id]);
    await addAudit(req.user.id, "delete_work_schedule", `Deleted ${current.name} order plan`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/work-orders/summary", async (req, res, next) => {
  try {
    const requestedWeek = req.query.weekStart || mondayForDate(datePartsInBusinessTimeZone().date);
    if (!isDate(requestedWeek)) return res.status(400).json({ error: "Order summary week is invalid." });
    const weekStart = mondayForDate(requestedWeek);
    const rows = await all(
      `SELECT tasks.id AS taskId, tasks.title, tasks.dueDate, tasks.status, tasks.completedAt,
              workSchedules.name AS orderName, workSchedules.supplier,
              workOrderSubmissions.amounts, workOrderSubmissions.status AS submissionStatus,
              workOrderSubmissions.submittedAt, users.username AS submittedByUsername
       FROM tasks
       JOIN workOrderSubmissions ON workOrderSubmissions.taskId = tasks.id
       LEFT JOIN workSchedules ON workSchedules.id = tasks.linkedRecordId
       LEFT JOIN users ON users.id = workOrderSubmissions.submittedBy
       WHERE tasks.taskType = 'recurring_order' AND tasks.dueDate >= ? AND tasks.dueDate <= ?
       ORDER BY tasks.dueDate ASC, tasks.id ASC`,
      [weekStart, addDays(weekStart, 6)]
    );
    res.json(rows.map((row) => {
      let amounts = {};
      try {
        amounts = typeof row.amounts === "object" ? row.amounts : JSON.parse(row.amounts || "{}");
      } catch (_error) {
        amounts = {};
      }
      return {
        ...row,
        orderName: row.orderName || String(row.title || "").replace(/^Order\s+—\s+/, ""),
        amounts,
        total: Object.values(amounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0),
        submittedAt: normaliseStoredTimestamp(row.submittedAt),
        completedAt: normaliseStoredTimestamp(row.completedAt)
      };
    }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/work-orders/:taskId", async (req, res, next) => {
  try {
    const view = await buildWorkOrderView(req.params.taskId, req.user);
    res.json(view);
  } catch (error) {
    next(error);
  }
});

app.put("/api/work-orders/:taskId/draft", async (req, res, next) => {
  try {
    const view = await buildWorkOrderView(req.params.taskId, req.user);
    if (!view.canEdit) throw requestError("This order is assigned to another staff member.", 403);
    const entry = normaliseWorkOrderPayload(req.body, view.schedule.departments);
    await saveWorkOrderSubmission(view.task.id, entry, "draft", req.user.id);
    if (view.task.status === "done") {
      await run("UPDATE tasks SET status = 'todo', completedAt = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [view.task.id]);
    }
    await addAudit(req.user.id, "save_work_order_draft", `Saved draft for ${view.task.title}`);
    res.json(await buildWorkOrderView(view.task.id, req.user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/work-orders/:taskId/submit", async (req, res, next) => {
  try {
    const view = await buildWorkOrderView(req.params.taskId, req.user);
    if (!view.canEdit) throw requestError("This order is assigned to another staff member.", 403);
    const entry = normaliseWorkOrderPayload(req.body, view.schedule.departments);
    await saveWorkOrderSubmission(view.task.id, entry, "submitted", req.user.id);
    const completedAt = new Date().toISOString();
    await run(
      "UPDATE tasks SET status = 'done', completedAt = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [completedAt, view.task.id]
    );
    await addAudit(req.user.id, "submit_work_order", `Submitted ${view.task.title} (£${entry.total.toFixed(2)})`);
    res.json(await buildWorkOrderView(view.task.id, req.user));
  } catch (error) {
    next(error);
  }
});

app.get("/api/gas-stock/current", async (req, res, next) => {
  try {
    const requestedWeek = req.query.weekStart || mondayForDate(datePartsInBusinessTimeZone().date);
    if (!isDate(requestedWeek)) return res.status(400).json({ error: "Gas stock week is invalid." });
    res.json(await buildGasStockView(mondayForDate(requestedWeek), req.user));
  } catch (error) {
    next(error);
  }
});

app.put("/api/gas-stock/draft", async (req, res, next) => {
  try {
    res.json(await saveGasStockCount(req, false));
  } catch (error) {
    next(error);
  }
});

app.post("/api/gas-stock/submit", async (req, res, next) => {
  try {
    res.json(await saveGasStockCount(req, true));
  } catch (error) {
    next(error);
  }
});

app.post("/api/notifications/:id/read", async (req, res, next) => {
  try {
    const notification = await get("SELECT id, staffId FROM notifications WHERE id = ?", [req.params.id]);
    if (!notification) return res.status(404).json({ error: "Notification not found." });
    if (req.user.role === "staff" && Number(notification.staffId) !== Number(req.user.staffId)) {
      return res.status(403).json({ error: "You cannot update this notification." });
    }
    await run("UPDATE notifications SET readAt = COALESCE(readAt, CURRENT_TIMESTAMP) WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks/completed", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(
      `SELECT tasks.*, staff.name AS assignedStaffName, users.username AS createdByUsername
       FROM tasks
       LEFT JOIN staff ON staff.id = tasks.assignedStaffId
       LEFT JOIN users ON users.id = tasks.createdBy
       WHERE tasks.status = 'done'
       ORDER BY COALESCE(tasks.completedAt, tasks.updatedAt) DESC, tasks.id DESC`
    );
    res.json(rows.map(normaliseTask));
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const { title = "", description = "", status = "todo", assignedStaffId = null } = req.body;
    const dueDate = req.body.dueDate || datePartsInBusinessTimeZone().date;
    const cleanTitle = String(title).trim();
    const cleanAssigneeId = normaliseTaskAssigneeId(assignedStaffId);
    if (!cleanTitle) return res.status(400).json({ error: "Task title is required." });
    if (!isTaskStatus(status)) return res.status(400).json({ error: "Task status is invalid." });
    if (!isDate(dueDate)) return res.status(400).json({ error: "Task date is invalid." });
    if (Number.isNaN(cleanAssigneeId)) return res.status(400).json({ error: "Task assignee is invalid." });
    if (cleanAssigneeId && !(await activeStaffExists(cleanAssigneeId))) {
      return res.status(400).json({ error: "Task assignee is not an active staff member." });
    }
    if (
      req.user.role !== "admin" &&
      cleanAssigneeId &&
      String(cleanAssigneeId) !== String(req.user.staffId)
    ) {
      return res.status(403).json({ error: "Staff can only assign a new task to themselves." });
    }

    const completedAt = status === "done" ? new Date().toISOString() : null;
    const result = await run(
      `INSERT INTO tasks (title, description, dueDate, status, assignedStaffId, createdBy, completedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanTitle,
        String(description || "").trim(),
        dueDate,
        status,
        cleanAssigneeId,
        req.user.id,
        completedAt
      ]
    );
    await addAudit(req.user.id, "create_task", `Created task ${cleanTitle}`);
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
    if (current.taskType === "gas_stock_count" && nextStatus === "done" && current.status !== "done") {
      return res.status(400).json({ error: "Submit the linked gas stock count to complete this task." });
    }

    const nextTitle = req.body.title === undefined ? current.title : String(req.body.title || "").trim();
    if (!nextTitle) return res.status(400).json({ error: "Task title is required." });
    const nextDueDate = req.body.dueDate === undefined ? current.dueDate : req.body.dueDate || null;
    if (nextDueDate && !isDate(nextDueDate)) return res.status(400).json({ error: "Task date is invalid." });
    const nextCompletedAt = nextStatus === "done"
      ? (current.status === "done" && current.completedAt ? current.completedAt : new Date().toISOString())
      : null;
    let nextAssigneeId = current.assignedStaffId || null;
    if (req.body.assignedStaffId !== undefined) {
      nextAssigneeId = normaliseTaskAssigneeId(req.body.assignedStaffId);
      if (Number.isNaN(nextAssigneeId)) return res.status(400).json({ error: "Task assignee is invalid." });
      if (nextAssigneeId && !(await activeStaffExists(nextAssigneeId))) {
        return res.status(400).json({ error: "Task assignee is not an active staff member." });
      }
      if (req.user.role !== "admin") {
        const ownStaffId = req.user.staffId;
        const alreadyAssignedToAnother =
          current.assignedStaffId &&
          String(current.assignedStaffId) !== String(ownStaffId);
        if (
          !ownStaffId ||
          !nextAssigneeId ||
          String(nextAssigneeId) !== String(ownStaffId) ||
          alreadyAssignedToAnother
        ) {
          return res.status(403).json({ error: "Staff can only claim an unassigned task for themselves." });
        }
      }
    }

    await run(
      `UPDATE tasks
       SET title = ?, description = ?, dueDate = ?, status = ?, assignedStaffId = ?, completedAt = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextTitle,
        req.body.description === undefined ? current.description || "" : String(req.body.description || "").trim(),
        nextDueDate,
        nextStatus,
        nextAssigneeId,
        nextCompletedAt,
        req.params.id
      ]
    );
    await addAudit(req.user.id, "update_task", `Updated task #${req.params.id} to ${nextStatus}`);
    const row = await getTask(req.params.id);
    res.json(normaliseTask(row));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:id", requireAdmin, async (req, res, next) => {
  try {
    const current = await getTask(req.params.id);
    if (!current) return res.status(404).json({ error: "Task not found." });
    await run("DELETE FROM workOrderSubmissions WHERE taskId = ?", [req.params.id]);
    await run("DELETE FROM tasks WHERE id = ?", [req.params.id]);
    await addAudit(req.user.id, "delete_task", `Deleted task #${req.params.id}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/push/public-key", async (_req, res, next) => {
  try {
    const key = await getPushPublicKey();
    res.json({ publicKey: key, enabled: Boolean(key && pushConfigured) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/push/status", async (req, res, next) => {
  try {
    if (!pushConfigured) {
      return res.json({
        enabled: false,
        subscriptions: 0,
        available: false,
        reason: "Push notifications are not configured on the server."
      });
    }
    if (!req.user.staffId) {
      return res.json({
        enabled: false,
        subscriptions: 0,
        available: true,
        reason: "This login is not linked to a staff member. Push reminders are sent to staff logins."
      });
    }
    const count = await get("SELECT COUNT(*) AS count FROM pushSubscriptions WHERE staffId = ?", [req.user.staffId]);
    res.json({ enabled: Number(count.count || 0) > 0, subscriptions: Number(count.count || 0), available: true });
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
    await addAudit(req.user.id, "enable_push", `${req.user.username} enabled push notifications`);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/push/test", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: "Only staff-linked users can test push notifications." });
    const result = await sendPushToStaff(req.user.staffId, {
      title: "Notifications enabled",
      message: "You will receive rota reminders on this device.",
      type: "push_test"
    });
    res.json({ ok: result.sent > 0, ...result });
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/my-feed", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: "Only staff-linked users have a calendar feed." });
    const token = await ensureUserCalendarToken(req.user.id);
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
    const avatarDataUrl = validateAvatarDataUrl(req.body.avatarDataUrl);
    if (!name || !role) return res.status(400).json({ error: "Name and role are required." });

    const result = await run(
      "INSERT INTO staff (name, phone, email, role, avatarDataUrl, active) VALUES (?, ?, ?, ?, ?, ?)",
      [name, phone, email, role, avatarDataUrl, active ? 1 : 0]
    );
    await createStaffUser(result.id, name);
    const row = await get("SELECT * FROM staff WHERE id = ?", [result.id]);
    await addAudit(req.user.id, "create_staff", `Created staff ${name}`);
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
      avatarDataUrl: req.body.avatarDataUrl === undefined ? current.avatarDataUrl : validateAvatarDataUrl(req.body.avatarDataUrl),
      active: req.body.active === undefined ? current.active : req.body.active ? 1 : 0
    };

    await run(
      `UPDATE staff
       SET name = ?, phone = ?, email = ?, role = ?, avatarDataUrl = ?, active = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextStaff.name, nextStaff.phone, nextStaff.email, nextStaff.role, nextStaff.avatarDataUrl, nextStaff.active, req.params.id]
    );
    await run("UPDATE users SET active = ?, updatedAt = CURRENT_TIMESTAMP WHERE staffId = ?", [nextStaff.active, req.params.id]);
    const row = await get("SELECT * FROM staff WHERE id = ?", [req.params.id]);
    await addAudit(req.user.id, "update_staff", `Updated staff ${row.name}`);
    await notifyStaff(row.id, "Staff details updated", "Admin updated your staff profile.", {
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
    const staffPublishedView = req.user.role === "staff";
    const shiftTable = staffPublishedView ? "publishedShifts" : "shifts";
    const idColumn = staffPublishedView ? "publishedShifts.sourceShiftId AS id," : "";
    const rows = await all(
      `SELECT ${idColumn} ${shiftTable}.*, staff.name AS staffName, staff.role, staff.active,
              coverStaff.name AS coverForStaffName,
              CASE WHEN timeOffRequests.id IS NULL THEN 0 ELSE 1 END AS approvedTimeOff
       FROM ${shiftTable}
       JOIN staff ON staff.id = ${shiftTable}.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = ${shiftTable}.coverForStaffId
       LEFT JOIN timeOffRequests
         ON timeOffRequests.staffId = ${shiftTable}.staffId
        AND timeOffRequests.status = 'approved'
        AND timeOffRequests.endDate >= timeOffRequests.startDate
        AND ${shiftTable}.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
       WHERE ${shiftTable}.shiftDate BETWEEN ? AND ?
         AND timeOffRequests.id IS NULL
       ORDER BY ${shiftTable}.shiftDate ASC, ${shiftTable}.isExtra ASC, ${shiftTable}.startTime ASC`,
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
      `SELECT publishedShifts.sourceShiftId AS id, publishedShifts.*, staff.name AS staffName, staff.role, staff.active,
              coverStaff.name AS coverForStaffName
       FROM publishedShifts
       JOIN staff ON staff.id = publishedShifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = publishedShifts.coverForStaffId
       WHERE publishedShifts.staffId = ? AND publishedShifts.shiftDate >= ?
       ORDER BY publishedShifts.shiftDate ASC, publishedShifts.startTime ASC
       LIMIT 30`,
      [req.user.staffId, today]
    );
    res.json(rows.map(decorateShift));
  } catch (error) {
    next(error);
  }
});

app.put("/api/staff/me/avatar", async (req, res, next) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: "This login is not linked to a staff profile." });
    const avatarDataUrl = validateAvatarDataUrl(req.body.avatarDataUrl);
    await run("UPDATE staff SET avatarDataUrl = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [avatarDataUrl, req.user.staffId]);
    await addAudit(req.user.id, "update_staff_avatar", `Updated avatar for staff #${req.user.staffId}`);
    res.json({ avatarDataUrl });
  } catch (error) {
    next(error);
  }
});

app.get("/api/shifts/publication", requireAdmin, async (req, res, next) => {
  try {
    const requestedDate = String(req.query.startDate || "");
    if (!isDate(requestedDate)) return res.status(400).json({ error: "Valid startDate is required." });
    const startDate = mondayForDate(requestedDate);
    const endDate = addDays(startDate, 6);
    const current = await all("SELECT * FROM shifts WHERE shiftDate BETWEEN ? AND ? ORDER BY id", [startDate, endDate]);
    const published = await all("SELECT * FROM publishedShifts WHERE weekStart = ? ORDER BY sourceShiftId", [startDate]);
    const publication = await get("SELECT * FROM rotaPublications WHERE weekStart = ?", [startDate]);
    const changes = countPublicationChanges(current, published);
    res.json({
      weekStart: startDate,
      published: Boolean(publication),
      publishedAt: publication?.publishedAt || null,
      publishedBy: publication?.publishedBy || null,
      changes,
      currentShifts: current.length,
      publishedShifts: published.length
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/shifts/publish", requireAdmin, async (req, res, next) => {
  try {
    const requestedDate = String(req.body.startDate || "");
    if (!isDate(requestedDate)) return res.status(400).json({ error: "Valid week start date is required." });
    const startDate = mondayForDate(requestedDate);
    const endDate = addDays(startDate, 6);
    const current = await all("SELECT * FROM shifts WHERE shiftDate BETWEEN ? AND ? ORDER BY id", [startDate, endDate]);
    const previous = await all("SELECT * FROM publishedShifts WHERE weekStart = ? ORDER BY sourceShiftId", [startDate]);
    const previousById = new Map(previous.map((shift) => [String(shift.sourceShiftId), shift]));
    const currentIds = new Set(current.map((shift) => String(shift.id)));

    for (const shift of current) {
      const old = previousById.get(String(shift.id));
      const unchanged = old && publishedShiftFingerprint(old) === sourceShiftFingerprint(shift);
      await run(
        `INSERT INTO publishedShifts
          (sourceShiftId, weekStart, staffId, shiftDate, startTime, endTime, breakMinutes, reminderMinutes,
           reminderTime, reminderSentAt, startReminderSentAt, notes, isExtra, coverForStaffId, patternGenerated, patternBatchId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(weekStart, sourceShiftId) DO UPDATE SET
           staffId = excluded.staffId, shiftDate = excluded.shiftDate, startTime = excluded.startTime,
           endTime = excluded.endTime, breakMinutes = excluded.breakMinutes, reminderMinutes = excluded.reminderMinutes,
           reminderTime = excluded.reminderTime, reminderSentAt = excluded.reminderSentAt,
           startReminderSentAt = excluded.startReminderSentAt, notes = excluded.notes, isExtra = excluded.isExtra,
           coverForStaffId = excluded.coverForStaffId, patternGenerated = excluded.patternGenerated,
           patternBatchId = excluded.patternBatchId`,
        [
          shift.id, startDate, shift.staffId, shift.shiftDate, shift.startTime, shift.endTime,
          shift.breakMinutes, shift.reminderMinutes,
          calculateReminderTime(shift.shiftDate, shift.startTime, shift.reminderMinutes),
          unchanged ? old.reminderSentAt : null,
          unchanged ? old.startReminderSentAt : null,
          shift.notes, shift.isExtra, shift.coverForStaffId, shift.patternGenerated || 0, shift.patternBatchId || null
        ]
      );
    }

    for (const old of previous) {
      if (!currentIds.has(String(old.sourceShiftId))) {
        await run("DELETE FROM publishedShifts WHERE weekStart = ? AND sourceShiftId = ?", [startDate, old.sourceShiftId]);
      }
    }

    await run(
      `INSERT INTO rotaPublications (weekStart, publishedAt, publishedBy)
       VALUES (?, CURRENT_TIMESTAMP, ?)
       ON CONFLICT(weekStart) DO UPDATE SET publishedAt = CURRENT_TIMESTAMP, publishedBy = excluded.publishedBy`,
      [startDate, req.user.id]
    );

    await sendPublicationNotifications(current, previous);
    const changes = countPublicationChanges(current, previous);
    await addAudit(req.user.id, "publish_rota", `Published ${current.length} shifts for week ${startDate} (${changes} changes)`);
    res.json({ ok: true, weekStart: startDate, shifts: current.length, changes, publishedAt: new Date().toISOString() });
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
      await run(
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
      copied += 1;
    }
    await addAudit(req.user.id, "copy_week", `Copied ${copied} shifts from ${fromStartDate} to ${toStartDate}`);
    res.json({ copied });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rota-patterns/generate", requireAdmin, async (req, res, next) => {
  try {
    const {
      startDate,
      endMode = "3m",
      customEndDate = "",
      replaceGenerated = false,
      entries = []
    } = req.body;

    if (!isDate(startDate)) return res.status(400).json({ error: "Valid week start date is required." });
    if (!Array.isArray(entries) || entries.length === 0) return res.status(400).json({ error: "Add at least one weekly shift pattern." });

    const cleanStart = mondayForDate(startDate);
    const cleanEnd = patternEndDate(cleanStart, endMode, customEndDate);
    if (!cleanEnd || cleanEnd < cleanStart) return res.status(400).json({ error: "End date must be after the week start." });

    const cleanEntries = entries.map((entry, index) => normalisePatternEntry(entry, index));
    const batchId = `pattern-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    let deleted = 0;
    let created = 0;
    let skipped = 0;

    if (replaceGenerated) {
      const result = await run(
        `DELETE FROM shifts
         WHERE patternGenerated = 1
           AND isExtra = 0
           AND shiftDate BETWEEN ? AND ?`,
        [cleanStart, cleanEnd]
      );
      deleted = result.changes;
    }

    for (let weekStart = cleanStart; weekStart <= cleanEnd; weekStart = addDays(weekStart, 7)) {
      for (const entry of cleanEntries) {
        const shiftDate = addDays(weekStart, entry.dayOffset);
        if (shiftDate > cleanEnd) continue;

        const existing = await get(
          `SELECT id FROM shifts
           WHERE staffId = ? AND shiftDate = ? AND startTime = ? AND endTime = ? AND isExtra = 0`,
          [entry.staffId, shiftDate, entry.startTime, entry.endTime]
        );
        if (existing) {
          skipped += 1;
          continue;
        }

        await run(
          `INSERT INTO shifts
            (staffId, shiftDate, startTime, endTime, breakMinutes, reminderMinutes, reminderTime, notes,
             isExtra, coverForStaffId, googleCalendarEventId, patternGenerated, patternBatchId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 1, ?)`,
          [
            entry.staffId,
            shiftDate,
            entry.startTime,
            entry.endTime,
            entry.breakMinutes,
            entry.reminderMinutes,
            calculateReminderTime(shiftDate, entry.startTime, entry.reminderMinutes),
            entry.notes,
            batchId
          ]
        );
        created += 1;
      }
    }

    await addAudit(req.user.id, "generate_rota_pattern", `Generated ${created} rota shifts from ${cleanStart} to ${cleanEnd}`);
    res.status(201).json({ created, skipped, deleted, startDate: cleanStart, endDate: cleanEnd, batchId });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
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
    await addAudit(req.user.id, "create_shift", `Created shift #${result.id}`);
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
    const reminderChanged =
      Number(current.staffId) !== Number(nextShift.staffId) ||
      current.shiftDate !== nextShift.shiftDate ||
      current.startTime !== nextShift.startTime ||
      Number(current.reminderMinutes) !== Number(nextShift.reminderMinutes);
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
    await addAudit(req.user.id, "update_shift", `Updated shift #${req.params.id}`);
    res.json(decorateShift(row));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/shifts/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await run("DELETE FROM shifts WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: "Shift not found." });
    await addAudit(req.user.id, "delete_shift", `Deleted shift #${req.params.id}`);
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
      `SELECT publishedShifts.sourceShiftId AS id, publishedShifts.*, staff.name AS staffName, staff.phone, staff.role,
              coverStaff.name AS coverForStaffName
       FROM publishedShifts
       JOIN staff ON staff.id = publishedShifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = publishedShifts.coverForStaffId
       WHERE staff.active = 1 AND publishedShifts.shiftDate >= ?
       ${staffFilter}
       ORDER BY publishedShifts.shiftDate ASC, publishedShifts.startTime ASC
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

  const statusCode = Number(error.statusCode || error.status || 500);
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal server error" : error.message,
    ...(process.env.NODE_ENV === "development" ? { message: error.message } : {})
  });
});

async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const cookieToken = parseCookies(req).fuelops_session || "";
    const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
    const token = cookieToken || bearerToken;
    const user = await getSessionUser(token);

    if (!user) return res.status(401).json({ error: "Please log in." });

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requirePasswordChange(req, res, next) {
  if (!req.user?.mustChangePassword) return next();
  res.status(403).json({ error: "Please change your temporary password before using the rota." });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access is required." });
  next();
}

initDb().then(async () => {
  await configurePushNotifications();
  app.listen(PORT, () => {
    console.log(`LocalPlanner Backend running on port ${PORT}`);
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

function mondayForDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(dateString, diff);
}

function addMonths(dateString, months) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return addDays(toDateString(date), -1);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function patternEndDate(startDate, mode, customEndDate) {
  if (mode === "1m") return addMonths(startDate, 1);
  if (mode === "3m") return addMonths(startDate, 3);
  if (mode === "6m") return addMonths(startDate, 6);
  if (mode === "year") return `${startDate.slice(0, 4)}-12-31`;
  if (mode === "custom" && isDate(customEndDate)) return customEndDate;
  const error = new Error("Choose a valid rota duration.");
  error.statusCode = 400;
  throw error;
}

function normalisePatternEntry(entry, index) {
  const dayOffset = Number(entry.dayOffset);
  const staffId = Number(entry.staffId);
  const breakMinutes = Number(entry.breakMinutes || 0);
  const reminderMinutes = Number(entry.reminderMinutes || 30);
  const startTime = String(entry.startTime || "");
  const endTime = String(entry.endTime || "");
  if (!staffId || !Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 6 || !isTime(startTime) || !isTime(endTime)) {
    const error = new Error(`Pattern row ${index + 1} needs staff, day, start time, and end time.`);
    error.statusCode = 400;
    throw error;
  }
  return {
    staffId,
    dayOffset,
    startTime,
    endTime,
    breakMinutes: Number.isFinite(breakMinutes) && breakMinutes >= 0 ? breakMinutes : 0,
    reminderMinutes: Number.isFinite(reminderMinutes) && reminderMinutes >= 0 ? reminderMinutes : 30,
    notes: String(entry.notes || "").trim()
  };
}

function isTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function validateAvatarDataUrl(value) {
  const avatarDataUrl = String(value || "");
  if (!avatarDataUrl) return "";
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(avatarDataUrl)) {
    const error = new Error("Profile photo must be a PNG, JPG, or WebP image.");
    error.statusCode = 400;
    throw error;
  }
  if (avatarDataUrl.length > 700000) {
    const error = new Error("Profile photo is too large. Choose an image under 500KB.");
    error.statusCode = 400;
    throw error;
  }
  return avatarDataUrl;
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

const publicationFields = [
  "staffId",
  "shiftDate",
  "startTime",
  "endTime",
  "breakMinutes",
  "reminderMinutes",
  "notes",
  "isExtra",
  "coverForStaffId"
];

function sourceShiftFingerprint(shift) {
  return JSON.stringify(publicationFields.map((field) => normalisePublicationValue(field, shift[field])));
}

function publishedShiftFingerprint(shift) {
  return JSON.stringify(publicationFields.map((field) => normalisePublicationValue(field, shift[field])));
}

function normalisePublicationValue(field, value) {
  if (["staffId", "breakMinutes", "reminderMinutes", "isExtra", "coverForStaffId"].includes(field)) {
    return Number(value || 0);
  }
  return String(value || "");
}

function countPublicationChanges(current, published) {
  const currentById = new Map(current.map((shift) => [String(shift.id), shift]));
  const publishedById = new Map(published.map((shift) => [String(shift.sourceShiftId), shift]));
  const ids = new Set([...currentById.keys(), ...publishedById.keys()]);
  let changes = 0;
  for (const id of ids) {
    const source = currentById.get(id);
    const snapshot = publishedById.get(id);
    if (!source || !snapshot || sourceShiftFingerprint(source) !== publishedShiftFingerprint(snapshot)) changes += 1;
  }
  return changes;
}

async function sendPublicationNotifications(current, previous) {
  const currentById = new Map(current.map((shift) => [String(shift.id), shift]));
  const previousById = new Map(previous.map((shift) => [String(shift.sourceShiftId), shift]));

  for (const shift of current) {
    const old = previousById.get(String(shift.id));
    if (!old) {
      await notifyStaff(shift.staffId, "New rota published", `You have a shift on ${shift.shiftDate} from ${shift.startTime} to ${shift.endTime}.`, {
        type: "shift_created",
        shiftId: shift.id
      });
      continue;
    }
    if (sourceShiftFingerprint(shift) === publishedShiftFingerprint(old)) continue;
    if (Number(old.staffId) !== Number(shift.staffId)) {
      await notifyStaff(old.staffId, "Published shift reassigned", `Your shift on ${old.shiftDate} from ${old.startTime} to ${old.endTime} was reassigned.`, {
        type: "shift_reassigned",
        shiftId: shift.id
      });
      await notifyStaff(shift.staffId, "New rota assignment", `You have a shift on ${shift.shiftDate} from ${shift.startTime} to ${shift.endTime}.`, {
        type: "shift_created",
        shiftId: shift.id
      });
    } else {
      await notifyStaff(shift.staffId, "Published shift updated", `Your shift on ${shift.shiftDate} is now ${shift.startTime} to ${shift.endTime}.`, {
        type: "shift_updated",
        shiftId: shift.id
      });
    }
  }

  for (const old of previous) {
    if (!currentById.has(String(old.sourceShiftId))) {
      await notifyStaff(old.staffId, "Published shift removed", `Your shift on ${old.shiftDate} from ${old.startTime} to ${old.endTime} was removed.`, {
        type: "shift_deleted",
        shiftId: old.sourceShiftId
      });
    }
  }
}

async function notifyStaff(staffId, title, message, { type = "rota_update", shiftId = null, timeOffRequestId = null } = {}) {
  if (!staffId) return;
  await run(
    `INSERT INTO notifications (staffId, type, title, message, shiftId, timeOffRequestId)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [staffId, type, title, message, shiftId, timeOffRequestId]
  );
  sendPushToStaff(staffId, { title, message, type, shiftId, timeOffRequestId }).catch((error) => {
    console.error("Push notification failed", error);
  });
}

async function configurePushNotifications() {
  const keys = await getOrCreateVapidKeys();
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

async function getOrCreateVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  }

  const publicRow = await get("SELECT value FROM settings WHERE key = ?", ["vapidPublicKey"]);
  const privateRow = await get("SELECT value FROM settings WHERE key = ?", ["vapidPrivateKey"]);
  if (publicRow?.value && privateRow?.value) {
    return { publicKey: publicRow.value, privateKey: privateRow.value };
  }

  const generated = webpush.generateVAPIDKeys();
  await run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["vapidPublicKey", generated.publicKey]
  );
  await run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["vapidPrivateKey", generated.privateKey]
  );
  return generated;
}

async function getPushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || (await get("SELECT value FROM settings WHERE key = ?", ["vapidPublicKey"]))?.value || "";
}

async function sendPushToStaff(staffId, { title, message, type = "rota_update", shiftId = null, timeOffRequestId = null } = {}) {
  const result = { subscriptions: 0, sent: 0, failed: 0, removed: 0 };
  if (!pushConfigured || !staffId) return result;
  const subscriptions = await all("SELECT * FROM pushSubscriptions WHERE staffId = ?", [staffId]);
  result.subscriptions = subscriptions.length;
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
      result.sent += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await run("DELETE FROM pushSubscriptions WHERE id = ?", [row.id]);
        result.removed += 1;
        return;
      }
      result.failed += 1;
      console.error("Push send failed", error.statusCode || "", error.message);
    }
  }));
  return result;
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
    `SELECT publishedShifts.sourceShiftId AS id, publishedShifts.*, staff.name AS staffName, staff.active,
            coverStaff.name AS coverForStaffName
     FROM publishedShifts
     JOIN staff ON staff.id = publishedShifts.staffId
     LEFT JOIN staff AS coverStaff ON coverStaff.id = publishedShifts.coverForStaffId
     LEFT JOIN timeOffRequests
       ON timeOffRequests.staffId = publishedShifts.staffId
      AND timeOffRequests.status = 'approved'
      AND timeOffRequests.endDate >= timeOffRequests.startDate
      AND publishedShifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
     WHERE staff.active = 1
       AND publishedShifts.reminderSentAt IS NULL
       AND publishedShifts.reminderTime <= ?
       AND publishedShifts.shiftDate >= ?
       AND timeOffRequests.id IS NULL
     ORDER BY publishedShifts.reminderTime ASC
     LIMIT 25`,
    [now, today]
  );

  for (const shift of due) {
    const decorated = decorateShift(shift);
    const startDate = shiftStartDate(decorated);
    if (startDate <= nowDate) {
      await run("UPDATE publishedShifts SET reminderSentAt = ? WHERE weekStart = ? AND sourceShiftId = ?", [now, shift.weekStart, decorated.id]);
      continue;
    }
    const coverText = decorated.isExtra && decorated.coverForStaffName ? ` Extra cover for ${decorated.coverForStaffName}.` : "";
    const noteText = decorated.notes ? ` Note: ${decorated.notes}.` : "";
    const message = `${decorated.reminderMessage}.${coverText}${noteText}`;
    await notifyStaff(decorated.staffId, "Shift starts soon", message, {
      type: "shift_reminder",
      shiftId: decorated.id
    });
    await run("UPDATE publishedShifts SET reminderSentAt = ? WHERE weekStart = ? AND sourceShiftId = ?", [now, shift.weekStart, decorated.id]);
  }
}

async function processDueStartPushes() {
  const now = new Date().toISOString();
  const nowDate = new Date(now);
  const today = now.slice(0, 10);
  const due = await all(
    `SELECT publishedShifts.sourceShiftId AS id, publishedShifts.*, staff.name AS staffName, staff.active,
            coverStaff.name AS coverForStaffName
     FROM publishedShifts
     JOIN staff ON staff.id = publishedShifts.staffId
     LEFT JOIN staff AS coverStaff ON coverStaff.id = publishedShifts.coverForStaffId
     LEFT JOIN timeOffRequests
       ON timeOffRequests.staffId = publishedShifts.staffId
      AND timeOffRequests.status = 'approved'
      AND timeOffRequests.endDate >= timeOffRequests.startDate
      AND publishedShifts.shiftDate BETWEEN timeOffRequests.startDate AND timeOffRequests.endDate
     WHERE staff.active = 1
       AND publishedShifts.startReminderSentAt IS NULL
       AND publishedShifts.shiftDate >= ?
       AND timeOffRequests.id IS NULL
     ORDER BY publishedShifts.shiftDate ASC, publishedShifts.startTime ASC
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
    await notifyStaff(decorated.staffId, "Shift starting now", message, {
      type: "shift_start",
      shiftId: decorated.id
    });
    await run("UPDATE publishedShifts SET startReminderSentAt = ? WHERE weekStart = ? AND sourceShiftId = ?", [now, shift.weekStart, decorated.id]);
  }
}

function shiftStartDate(shift) {
  return shiftStartInstant(shift.shiftDate, shift.startTime);
}

async function ensureWeeklyGasStockTask(configValue = null) {
  const config = configValue || await getGasStockConfig();
  if (!config.enabled) return null;
  const weekStart = mondayForDate(datePartsInBusinessTimeZone().date);
  const dueDate = addDays(weekStart, Number(config.weekday || 0));
  let task = await get(
    "SELECT * FROM tasks WHERE taskType = ? AND dueDate = ? ORDER BY id DESC LIMIT 1",
    ["gas_stock_count", dueDate]
  );

  if (!task) {
    const result = await run(
      `INSERT INTO tasks (title, description, dueDate, status, assignedStaffId, createdBy, completedAt, taskType)
       VALUES (?, ?, ?, 'todo', ?, NULL, NULL, ?)`,
      [
        "Count gas stock",
        "Enter this week's full bottle quantities and submit the stock count.",
        dueDate,
        config.assignedStaffId || null,
        "gas_stock_count"
      ]
    );
    task = await getTask(result.id);
    if (config.assignedStaffId) {
      await notifyStaff(
        config.assignedStaffId,
        "Weekly gas stock count",
        `Your gas stock count is due on ${dueDate}.`,
        { type: "gas_stock_count" }
      );
    }
  } else if (
    task.status !== "done" &&
    String(task.assignedStaffId || "") !== String(config.assignedStaffId || "")
  ) {
    await run(
      "UPDATE tasks SET assignedStaffId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [config.assignedStaffId || null, task.id]
    );
    task = await getTask(task.id);
  }

  return normaliseTask(task);
}

async function buildGasStockView(weekStart, user) {
  const config = await getGasStockConfig();
  const currentWeekStart = mondayForDate(datePartsInBusinessTimeZone().date);
  const dueDate = addDays(weekStart, Number(config.weekday || 0));
  const task = weekStart === currentWeekStart
    ? await ensureWeeklyGasStockTask(config)
    : await getTaskByTypeAndDueDate("gas_stock_count", dueDate);
  const count = await get("SELECT * FROM gasStockCounts WHERE weekStart = ?", [weekStart]);
  const entries = count
    ? await all("SELECT * FROM gasStockEntries WHERE countId = ? ORDER BY id ASC", [count.id])
    : [];
  const previousCount = await get(
    `SELECT * FROM gasStockCounts
     WHERE weekStart < ? AND status = 'submitted'
     ORDER BY weekStart DESC LIMIT 1`,
    [weekStart]
  );
  const previousEntries = previousCount
    ? await all("SELECT * FROM gasStockEntries WHERE countId = ?", [previousCount.id])
    : [];
  const currentByProduct = new Map(entries.map((entry) => [entry.productId, Number(entry.quantity)]));
  const previousByProduct = new Map(previousEntries.map((entry) => [entry.productId, Number(entry.quantity)]));
  const canEdit = Boolean(
    config.enabled &&
    (user.role === "admin" || (
      weekStart === currentWeekStart &&
      (!config.assignedStaffId || Number(config.assignedStaffId) === Number(user.staffId))
    ))
  );

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    dueDate,
    currentWeek: weekStart === currentWeekStart,
    canEdit,
    config,
    task: task ? normaliseTask(task) : null,
    count: count ? {
      ...count,
      taskId: count.taskId || null,
      submittedAt: normaliseStoredTimestamp(count.submittedAt)
    } : null,
    previousWeekStart: previousCount?.weekStart || null,
    notes: count?.notes || "",
    products: config.products.filter((product) => product.active).map((product) => {
      const quantity = currentByProduct.has(product.id) ? currentByProduct.get(product.id) : null;
      const previousQuantity = previousByProduct.has(product.id) ? previousByProduct.get(product.id) : null;
      return {
        ...product,
        quantity,
        previousQuantity,
        change: quantity !== null && previousQuantity !== null ? quantity - previousQuantity : null,
        lowStock: quantity !== null && quantity <= Number(product.reorderLevel || 0)
      };
    })
  };
}

async function saveGasStockCount(req, submit) {
  const config = await getGasStockConfig();
  if (!config.enabled) throw requestError("Gas stock counting is disabled in Business Settings.", 400);
  const suppliedWeek = req.body.weekStart || mondayForDate(datePartsInBusinessTimeZone().date);
  if (!isDate(suppliedWeek)) throw requestError("Gas stock week is invalid.", 400);
  const weekStart = mondayForDate(suppliedWeek);
  const currentWeekStart = mondayForDate(datePartsInBusinessTimeZone().date);
  const assignedToUser = !config.assignedStaffId || Number(config.assignedStaffId) === Number(req.user.staffId);
  if (req.user.role !== "admin" && (weekStart !== currentWeekStart || !assignedToUser)) {
    throw requestError("This gas stock count is not assigned to you.", 403);
  }

  const activeProducts = config.products.filter((product) => product.active);
  const quantities = req.body.quantities && typeof req.body.quantities === "object" ? req.body.quantities : {};
  const cleaned = new Map();
  for (const product of activeProducts) {
    const raw = quantities[product.id];
    if (raw === undefined || raw === null || raw === "") {
      if (submit) throw requestError(`Enter the quantity for ${product.name}.`, 400);
      continue;
    }
    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw requestError(`${product.name} must be a whole number of zero or more.`, 400);
    }
    cleaned.set(product.id, quantity);
  }

  const dueDate = addDays(weekStart, Number(config.weekday || 0));
  const task = weekStart === currentWeekStart
    ? await ensureWeeklyGasStockTask(config)
    : await getTaskByTypeAndDueDate("gas_stock_count", dueDate);
  let count = await get("SELECT * FROM gasStockCounts WHERE weekStart = ?", [weekStart]);
  if (count?.status === "submitted" && req.user.role !== "admin") {
    throw requestError("This gas stock count has already been submitted. Ask an admin to correct it.", 403);
  }
  const submittedAt = submit ? new Date().toISOString() : null;
  if (!count) {
    const result = await run(
      `INSERT INTO gasStockCounts (weekStart, taskId, status, notes, countedBy, submittedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [weekStart, task?.id || null, submit ? "submitted" : "draft", String(req.body.notes || "").trim(), req.user.id, submittedAt]
    );
    count = await get("SELECT * FROM gasStockCounts WHERE id = ?", [result.id]);
  } else {
    await run(
      `UPDATE gasStockCounts
       SET taskId = ?, status = ?, notes = ?, countedBy = ?, submittedAt = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [task?.id || count.taskId || null, submit ? "submitted" : "draft", String(req.body.notes || "").trim(), req.user.id, submittedAt, count.id]
    );
  }

  await run("DELETE FROM gasStockEntries WHERE countId = ?", [count.id]);
  for (const product of activeProducts) {
    if (!cleaned.has(product.id)) continue;
    await run(
      `INSERT INTO gasStockEntries (countId, productId, productName, quantity, reorderLevel)
       VALUES (?, ?, ?, ?, ?)`,
      [count.id, product.id, product.name, cleaned.get(product.id), Number(product.reorderLevel || 0)]
    );
  }

  if (task?.id) {
    await run(
      `UPDATE tasks
       SET status = ?, linkedRecordId = ?, completedAt = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [submit ? "done" : "process", count.id, submit ? submittedAt : null, task.id]
    );
  }
  await addAudit(
    req.user.id,
    submit ? "submit_gas_stock" : "save_gas_stock_draft",
    `${submit ? "Submitted" : "Saved"} gas stock count for ${weekStart}`
  );
  return buildGasStockView(weekStart, req.user);
}

function getTaskByTypeAndDueDate(taskType, dueDate) {
  return get(
    `SELECT tasks.*, staff.name AS assignedStaffName, users.username AS createdByUsername
     FROM tasks
     LEFT JOIN staff ON staff.id = tasks.assignedStaffId
     LEFT JOIN users ON users.id = tasks.createdBy
     WHERE tasks.taskType = ? AND tasks.dueDate = ?
     ORDER BY tasks.id DESC LIMIT 1`,
    [taskType, dueDate]
  );
}

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

async function ensureRecurringWorkTasks(weekStart = mondayForDate(datePartsInBusinessTimeZone().date)) {
  const schedules = await all("SELECT * FROM workSchedules WHERE active = 1 ORDER BY id ASC");
  for (const row of schedules) {
    const schedule = normaliseWorkSchedule(row);
    for (const weekday of schedule.weekdays) {
      const dueDate = addDays(weekStart, weekday === 0 ? 6 : weekday - 1);
      const existing = await get(
        `SELECT id FROM tasks
         WHERE taskType = 'recurring_order' AND linkedRecordId = ? AND dueDate = ?
         LIMIT 1`,
        [schedule.id, dueDate]
      );
      if (existing) continue;
      const detail = [schedule.supplier ? `Supplier: ${schedule.supplier}` : "", schedule.notes]
        .filter(Boolean)
        .join(" · ");
      await run(
        `INSERT INTO tasks (title, description, dueDate, status, assignedStaffId, createdBy, completedAt, taskType, linkedRecordId)
         VALUES (?, ?, ?, 'todo', ?, ?, NULL, 'recurring_order', ?)`,
        [
          `Order — ${schedule.name}`,
          detail,
          dueDate,
          schedule.assignedStaffId,
          schedule.createdBy,
          schedule.id
        ]
      );
    }
  }
}

function getWorkSchedule(id) {
  return get(
    `SELECT workSchedules.*, staff.name AS assignedStaffName
     FROM workSchedules
     LEFT JOIN staff ON staff.id = workSchedules.assignedStaffId
     WHERE workSchedules.id = ?`,
    [id]
  );
}

function normaliseWorkSchedule(row) {
  if (!row) return row;
  let weekdays = [];
  try {
    const parsed = Array.isArray(row.weekdays) ? row.weekdays : JSON.parse(row.weekdays || "[]");
    weekdays = [...new Set(parsed.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  } catch (_error) {
    weekdays = [];
  }
  let departments = [];
  try {
    const parsed = Array.isArray(row.departments) ? row.departments : JSON.parse(row.departments || "[]");
    departments = [...new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 12);
  } catch (_error) {
    departments = [];
  }
  return {
    ...row,
    active: Boolean(row.active),
    assignedStaffId: row.assignedStaffId || null,
    weekdays,
    departments: departments.length ? departments : ["Total order"]
  };
}

async function validateWorkSchedule(value = {}) {
  const name = String(value.name || "").trim();
  if (!name) throw requestError("Order category is required.");
  const weekdays = [...new Set((Array.isArray(value.weekdays) ? value.weekdays : [])
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  if (!weekdays.length) throw requestError("Choose at least one ordering day.");
  const assignedStaffId = normaliseTaskAssigneeId(value.assignedStaffId);
  if (Number.isNaN(assignedStaffId)) throw requestError("Order plan assignee is invalid.");
  if (assignedStaffId && !(await activeStaffExists(assignedStaffId))) {
    throw requestError("Order plan assignee is not an active staff member.");
  }
  const departments = [...new Set((Array.isArray(value.departments) ? value.departments : [])
    .map((department) => String(department || "").trim())
    .filter(Boolean))].slice(0, 12);
  return {
    name,
    category: String(value.category || "Ordering").trim() || "Ordering",
    supplier: String(value.supplier || "").trim(),
    weekdays,
    departments: departments.length ? departments : ["Total order"],
    notes: String(value.notes || "").trim(),
    active: value.active !== false,
    assignedStaffId
  };
}

async function buildWorkOrderView(taskId, user) {
  const task = await getTask(taskId);
  if (!task || task.taskType !== "recurring_order") throw requestError("Order task not found.", 404);
  const scheduleRow = await getWorkSchedule(task.linkedRecordId);
  let schedule = scheduleRow
    ? normaliseWorkSchedule(scheduleRow)
    : { id: task.linkedRecordId, name: task.title.replace(/^Order\s+—\s+/, ""), supplier: "", departments: ["Total order"], notes: "" };
  const submissionRow = await get(
    `SELECT workOrderSubmissions.*, users.username AS submittedByUsername
     FROM workOrderSubmissions
     LEFT JOIN users ON users.id = workOrderSubmissions.submittedBy
     WHERE workOrderSubmissions.taskId = ?`,
    [task.id]
  );
  if (submissionRow?.amounts) {
    try {
      const savedDepartments = Object.keys(typeof submissionRow.amounts === "object" ? submissionRow.amounts : JSON.parse(submissionRow.amounts));
      if (savedDepartments.length) schedule = { ...schedule, departments: savedDepartments };
    } catch (_error) {
      // Keep the current order-plan sections if an old draft cannot be parsed.
    }
  }
  const ownAssignment = task.assignedStaffId && String(task.assignedStaffId) === String(user?.staffId);
  return {
    task: normaliseTask(task),
    schedule,
    submission: normaliseWorkOrderSubmission(submissionRow, schedule.departments),
    canEdit: user?.role === "admin" || !task.assignedStaffId || ownAssignment
  };
}

function normaliseWorkOrderPayload(value = {}, departments = []) {
  const source = value.amounts && typeof value.amounts === "object" ? value.amounts : {};
  const amounts = {};
  departments.forEach((department) => {
    const raw = source[department];
    const amount = raw === "" || raw === null || raw === undefined ? 0 : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) throw requestError(`${department} value must be zero or more.`);
    amounts[department] = Math.round(amount * 100) / 100;
  });
  return {
    amounts,
    total: Object.values(amounts).reduce((sum, amount) => sum + amount, 0),
    reference: String(value.reference || "").trim(),
    notes: String(value.notes || "").trim()
  };
}

function normaliseWorkOrderSubmission(row, departments = []) {
  let amounts = {};
  try {
    amounts = row?.amounts && typeof row.amounts === "object" ? row.amounts : JSON.parse(row?.amounts || "{}");
  } catch (_error) {
    amounts = {};
  }
  const cleanAmounts = Object.fromEntries(departments.map((department) => {
    const amount = Number(amounts[department] || 0);
    return [department, Number.isFinite(amount) ? amount : 0];
  }));
  return {
    id: row?.id || null,
    taskId: row?.taskId || null,
    amounts: cleanAmounts,
    total: Object.values(cleanAmounts).reduce((sum, amount) => sum + amount, 0),
    reference: row?.reference || "",
    notes: row?.notes || "",
    status: row?.status || "not_started",
    submittedBy: row?.submittedBy || null,
    submittedByUsername: row?.submittedByUsername || "",
    submittedAt: normaliseStoredTimestamp(row?.submittedAt)
  };
}

async function saveWorkOrderSubmission(taskId, entry, status, userId) {
  const submittedAt = status === "submitted" ? new Date().toISOString() : null;
  const submittedBy = status === "submitted" ? userId : null;
  await run(
    `INSERT INTO workOrderSubmissions (taskId, amounts, reference, notes, status, submittedBy, submittedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(taskId) DO UPDATE SET
       amounts = excluded.amounts,
       reference = excluded.reference,
       notes = excluded.notes,
       status = excluded.status,
       submittedBy = excluded.submittedBy,
       submittedAt = excluded.submittedAt,
       updatedAt = CURRENT_TIMESTAMP`,
    [taskId, JSON.stringify(entry.amounts), entry.reference, entry.notes, status, submittedBy, submittedAt]
  );
}

function normaliseTask(row) {
  if (!row) return row;
  const completedAt = normaliseStoredTimestamp(row.completedAt);
  return {
    ...row,
    assignedStaffId: row.assignedStaffId || null,
    createdBy: row.createdBy || null,
    completedAt,
    archived: isTaskArchived({ ...row, completedAt })
  };
}

function normaliseAttendance(row) {
  if (!row) return null;
  return {
    ...row,
    staffId: Number(row.staffId),
    shiftId: row.shiftId ? Number(row.shiftId) : null,
    clockInLocationChecked: Boolean(row.clockInLocationChecked),
    clockOutLocationChecked: Boolean(row.clockOutLocationChecked)
  };
}

function getAttendanceEntry(id) {
  return get(
    `SELECT attendance.*, staff.name AS staffName, shifts.shiftDate, shifts.startTime, shifts.endTime
     FROM attendance
     JOIN staff ON staff.id = attendance.staffId
     LEFT JOIN shifts ON shifts.id = attendance.shiftId
     WHERE attendance.id = ?`,
    [id]
  );
}

function getAttendanceOpenEntry(staffId) {
  return get(
    `SELECT attendance.*, staff.name AS staffName, shifts.shiftDate, shifts.startTime, shifts.endTime
     FROM attendance
     JOIN staff ON staff.id = attendance.staffId
     LEFT JOIN shifts ON shifts.id = attendance.shiftId
     WHERE attendance.staffId = ? AND attendance.clockOutAt IS NULL
     ORDER BY attendance.clockInAt DESC
     LIMIT 1`,
    [staffId]
  );
}

function listAttendanceEntries({ staffId = null, limit = 80 } = {}) {
  const staffFilter = staffId ? "WHERE attendance.staffId = ?" : "";
  const params = staffId ? [staffId, limit] : [limit];
  return all(
    `SELECT attendance.*, staff.name AS staffName, shifts.shiftDate, shifts.startTime, shifts.endTime
     FROM attendance
     JOIN staff ON staff.id = attendance.staffId
     LEFT JOIN shifts ON shifts.id = attendance.shiftId
     ${staffFilter}
     ORDER BY attendance.clockInAt DESC
     LIMIT ?`,
    params
  );
}

function readAttendanceLocation(body, required, actionLabel) {
  const latitude = body.latitude === undefined || body.latitude === null || body.latitude === "" ? null : Number(body.latitude);
  const longitude = body.longitude === undefined || body.longitude === null || body.longitude === "" ? null : Number(body.longitude);
  const accuracy = body.accuracy === undefined || body.accuracy === null || body.accuracy === "" ? null : Number(body.accuracy);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  if (required && !hasLocation) {
    const error = new Error(`Location permission is required to ${actionLabel}.`);
    error.statusCode = 400;
    throw error;
  }

  return {
    latitude: hasLocation ? latitude : null,
    longitude: hasLocation ? longitude : null,
    accuracy: hasLocation && Number.isFinite(accuracy) ? accuracy : null,
    checked: hasLocation
  };
}

function isTaskStatus(status) {
  return ["backlog", "todo", "process", "done"].includes(status);
}

function isTaskArchived(task) {
  if (task.status !== "done" || !task.completedAt) return false;
  const completedAt = new Date(task.completedAt).getTime();
  return Number.isFinite(completedAt) && Date.now() - completedAt >= taskArchiveAfterMs;
}

function normaliseStoredTimestamp(value) {
  if (!value) return null;
  const text = String(value);
  const withTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text)
    ? text
    : `${text.replace(" ", "T")}Z`;
  const date = new Date(withTimeZone);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function normaliseTaskAssigneeId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : Number.NaN;
}

async function activeStaffExists(staffId) {
  const row = await get("SELECT id FROM staff WHERE id = ? AND active = 1", [staffId]);
  return Boolean(row);
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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
    "PRODID:-//LocalPlanner//Rota Calendar//EN",
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
    `UID:localplanner-shift-${shift.id}@localplanner`,
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
