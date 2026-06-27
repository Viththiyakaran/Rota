import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  all,
  calculateReminderTime,
  createSession,
  createStaffUser,
  decorateShift,
  deleteSession,
  findUserByUsername,
  get,
  getBranding,
  getSessionUser,
  initDb,
  publicUser,
  run,
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

app.use("/api", requireAuth);

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
    res.json(decorateShift(row));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/shifts/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await run("DELETE FROM shifts WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: "Shift not found." });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/reminders/upcoming", async (_req, res, next) => {
  try {
    const now = new Date().toISOString();
    const rows = await all(
      `SELECT shifts.*, staff.name AS staffName, staff.phone, staff.role,
              coverStaff.name AS coverForStaffName
       FROM shifts
       JOIN staff ON staff.id = shifts.staffId
       LEFT JOIN staff AS coverStaff ON coverStaff.id = shifts.coverForStaffId
       WHERE staff.active = 1 AND reminderTime >= ?
       ORDER BY reminderTime ASC
       LIMIT 20`,
      [now]
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
