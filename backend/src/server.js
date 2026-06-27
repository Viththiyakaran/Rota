import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  findUserByUsername,
  get,
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
  updateOpeningHours,
  updateUser,
  updateBranding,
  verifyPassword
} from "./db.js";

const app = express();
const port = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Rota API" });
});

app.get("/api/settings/branding", (_req, res) => {
  res.json(getBranding());
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { username = "", password = "" } = req.body;
    const user = findUserByUsername(username.trim());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const session = createSession(user.id);
    const sessionUser = getSessionUser(session.token);
    res.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(sessionUser) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  deleteSession(req.token);
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
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireAuth);

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
    const { openingStart, openingEnd } = req.body;
    if (!isTime(openingStart) || !isTime(openingEnd)) return res.status(400).json({ error: "Opening hours must be valid times." });
    const saved = updateOpeningHours({ openingStart, openingEnd });
    addAudit(req.user.id, "update_opening_hours", `${openingStart}-${openingEnd}`);
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
    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit", requireAdmin, (_req, res) => {
  res.json(listAudit());
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
              coverStaff.name AS coverForStaffName
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       WHERE shiftDate BETWEEN ? AND ?
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
      reminderMinutes = 60,
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
        Number(reminderMinutes || 60),
        calculateReminderTime(shiftDate, startTime, reminderMinutes),
        notes,
        isExtra ? 1 : 0,
        coverForStaffId || null,
        googleCalendarEventId
      ]
    );
    const row = await getShift(result.id);
    addAudit(req.user.id, "create_shift", `Created shift #${result.id}`);
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

    await run(
      `UPDATE shifts
       SET staffId = ?, shiftDate = ?, startTime = ?, endTime = ?, breakMinutes = ?,
           reminderMinutes = ?, reminderTime = ?, notes = ?, isExtra = ?, coverForStaffId = ?, googleCalendarEventId = ?,
           updatedAt = CURRENT_TIMESTAMP
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
        req.params.id
      ]
    );
    const row = await getShift(req.params.id);
    addAudit(req.user.id, "update_shift", `Updated shift #${req.params.id}`);
    res.json(decorateShift(row));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/shifts/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await run("DELETE FROM shifts WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: "Shift not found." });
    addAudit(req.user.id, "delete_shift", `Deleted shift #${req.params.id}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/reminders/upcoming", async (_req, res, next) => {
  try {
    const now = new Date().toISOString();
    const staffFilter = req.user.role === "staff" && req.user.staffId ? "AND staff.id = ?" : "";
    const params = req.user.role === "staff" && req.user.staffId ? [now, req.user.staffId] : [now];
    const rows = await all(
      `SELECT shifts.*, staff.name AS staffName, staff.phone, staff.role,
              coverStaff.name AS coverForStaffName
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       WHERE staff.active = 1 AND reminderTime >= ?
       ${staffFilter}
       ORDER BY reminderTime ASC
       LIMIT 20`,
      params
    );
    res.json(rows.map(decorateShift));
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      name: "Rota API",
      message: "Frontend build not found. Use the frontend service URL, or build the frontend before starting this service."
    });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = getSessionUser(token);

  if (!user) return res.status(401).json({ error: "Please log in." });

  req.token = token;
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access is required." });
  next();
}

initDb().then(() => {
  app.listen(port, () => {
    console.log(`Rota API running on http://localhost:${port}`);
  });
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
