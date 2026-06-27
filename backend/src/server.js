import cors from "cors";
import express from "express";
import { all, calculateReminderTime, decorateShift, get, initDb, run } from "./db.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "FuelOps Rota API" });
});

app.get("/api/staff", async (_req, res, next) => {
  try {
    const rows = await all("SELECT * FROM staff ORDER BY active DESC, id ASC");
    res.json(rows.map((row) => ({ ...row, active: Boolean(row.active) })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/staff", async (req, res, next) => {
  try {
    const { name, phone = "", email = "", role, active = true } = req.body;
    if (!name || !role) return res.status(400).json({ error: "Name and role are required." });

    const result = await run(
      "INSERT INTO staff (name, phone, email, role, active) VALUES (?, ?, ?, ?, ?)",
      [name, phone, email, role, active ? 1 : 0]
    );
    const row = await get("SELECT * FROM staff WHERE id = ?", [result.id]);
    res.status(201).json({ ...row, active: Boolean(row.active) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/staff/:id", async (req, res, next) => {
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

app.post("/api/shifts", async (req, res, next) => {
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

app.put("/api/shifts/:id", async (req, res, next) => {
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

app.delete("/api/shifts/:id", async (req, res, next) => {
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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

initDb().then(() => {
  app.listen(port, () => {
    console.log(`FuelOps Rota API running on http://localhost:${port}`);
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
