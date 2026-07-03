import React from "react";
import { CalendarDays, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, darkButton, primaryButton, softButton } from "../components/PageHeader.jsx";
import { addDays, formatDateLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";

const days = [
  { offset: 0, label: "Monday" },
  { offset: 1, label: "Tuesday" },
  { offset: 2, label: "Wednesday" },
  { offset: 3, label: "Thursday" },
  { offset: 4, label: "Friday" },
  { offset: 5, label: "Saturday" },
  { offset: 6, label: "Sunday" }
];

const durations = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "year", label: "End of year" },
  { value: "custom", label: "Custom" }
];

export function RotaPattern({ goTo }) {
  const [staff, setStaff] = React.useState([]);
  const [rows, setRows] = React.useState([]);
  const [weekStart, setWeekStart] = React.useState(toDateInputValue(getMonday()));
  const [endMode, setEndMode] = React.useState("3m");
  const [customEndDate, setCustomEndDate] = React.useState("");
  const [replaceGenerated, setReplaceGenerated] = React.useState(true);
  const [draft, setDraft] = React.useState({
    staffId: "",
    dayOffset: 0,
    startTime: "05:30",
    endTime: "22:00",
    breakMinutes: 0,
    reminderMinutes: 30,
    notes: ""
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    Promise.all([api.staff(), api.openingHours()])
      .then(([staffRows, hours]) => {
        const activeStaff = staffRows.filter((person) => person.active);
        setStaff(activeStaff);
        setDraft((current) => ({
          ...current,
          staffId: activeStaff[0]?.id || "",
          startTime: hours.openingStart || "05:30",
          endTime: hours.openingEnd || "22:00"
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const imported = JSON.parse(sessionStorage.getItem("fuelopsRotaAiRows") || "null");
    if (!imported?.rows?.length) return;
    sessionStorage.removeItem("fuelopsRotaAiRows");
    setWeekStart(imported.weekStart || weekStart);
    setRows(imported.rows);
    setMessage(`Imported ${imported.rows.length} shifts from Rota AI.`);
  }, []);

  const weekEnd = toDateInputValue(addDays(new Date(`${weekStart}T00:00:00`), 6));
  const endDate = previewEndDate(weekStart, endMode, customEndDate);

  const addPatternRow = () => {
    if (!draft.staffId || !draft.startTime || !draft.endTime) {
      setError("Choose staff and hours before adding a row.");
      return;
    }
    setRows((current) => [...current, { ...draft, id: crypto.randomUUID() }]);
    setMessage("");
    setError("");
  };

  const removeRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const loadCurrentWeek = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const shifts = await api.week(weekStart);
      const imported = shifts
        .filter((shift) => !shift.isExtra)
        .map((shift) => ({
          id: crypto.randomUUID(),
          staffId: String(shift.staffId),
          dayOffset: daysBetween(weekStart, shift.shiftDate),
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes || 0,
          reminderMinutes: shift.reminderMinutes || 30,
          notes: shift.notes || ""
        }))
        .filter((shift) => shift.dayOffset >= 0 && shift.dayOffset <= 6);
      setRows(imported);
      setMessage(imported.length ? `Loaded ${imported.length} shifts from this week.` : "No normal shifts found for this week.");
    } catch (err) {
      setError(err.message || "Could not load this week.");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (rows.length === 0) {
      setError("Add at least one shift to the weekly pattern.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api.generateRotaPattern({
        startDate: weekStart,
        endMode,
        customEndDate,
        replaceGenerated,
        entries: rows.map(({ id: _id, ...row }) => ({
          ...row,
          staffId: Number(row.staffId),
          dayOffset: Number(row.dayOffset),
          breakMinutes: Number(row.breakMinutes || 0),
          reminderMinutes: Number(row.reminderMinutes || 30)
        }))
      });
      setMessage(`Created ${result.created} shifts from ${formatDateLabel(result.startDate)} to ${formatDateLabel(result.endDate)}. Skipped ${result.skipped}.`);
    } catch (err) {
      setError(err.message || "Could not generate rota pattern.");
    } finally {
      setSaving(false);
    }
  };

  const groupedRows = days.map((day) => ({
    ...day,
    rows: rows.filter((row) => Number(row.dayOffset) === day.offset)
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Rota Pattern"
        description="Build one normal week, then repeat it for 1 month, 3 months, 6 months, custom dates, or the end of the year. Use One-off Shift for temporary cover."
        meta={<Pill tone="lime">{rows.length} weekly shifts</Pill>}
      />

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field label="First week start">
            <input
              type="date"
              className={inputClass}
              value={weekStart}
              onChange={(event) => setWeekStart(toDateInputValue(getMonday(new Date(`${event.target.value}T00:00:00`))))}
            />
          </Field>
          <button type="button" className={softButton} onClick={loadCurrentWeek} disabled={saving || loading}>
            <RefreshCw size={18} />
            Import current week
          </button>
        </div>
        <p className="mt-2 text-sm font-bold text-slate-600">
          Pattern week: {formatDateLabel(weekStart)} to {formatDateLabel(weekEnd)}
        </p>
      </Card>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <Field label="Staff">
            <select className={inputClass} value={draft.staffId} onChange={(event) => setDraft({ ...draft, staffId: event.target.value })}>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Day">
            <select className={inputClass} value={draft.dayOffset} onChange={(event) => setDraft({ ...draft, dayOffset: Number(event.target.value) })}>
              {days.map((day) => (
                <option key={day.offset} value={day.offset}>{day.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input type="time" className={inputClass} value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} />
            </Field>
            <Field label="End">
              <input type="time" className={inputClass} value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} />
            </Field>
          </div>
          <button type="button" className={primaryButton} onClick={addPatternRow}>
            <Plus size={18} />
            Add to week
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Break mins">
            <input type="number" min="0" className={inputClass} value={draft.breakMinutes} onChange={(event) => setDraft({ ...draft, breakMinutes: event.target.value })} />
          </Field>
          <Field label="Reminder mins">
            <input type="number" min="0" className={inputClass} value={draft.reminderMinutes} onChange={(event) => setDraft({ ...draft, reminderMinutes: event.target.value })} />
          </Field>
          <Field label="Note">
            <input className={inputClass} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Cleaning, shopping, till cover" />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-black">Weekly pattern</h3>
            <p className="text-sm font-bold text-slate-600">Only normal repeating rota shifts belong here.</p>
          </div>
          {rows.length > 0 && (
            <button type="button" className={softButton} onClick={() => setRows([])}>
              Clear pattern
            </button>
          )}
        </div>
        <div className="grid gap-3 lg:grid-cols-7">
          {groupedRows.map((day) => (
            <section key={day.offset} className="min-h-32 rounded-lg border border-fuel-line bg-fuel-mist/40 p-3">
              <h4 className="font-black text-fuel-ink">{day.label}</h4>
              <div className="mt-3 space-y-2">
                {day.rows.length === 0 && <p className="text-sm font-bold text-slate-400">No shift</p>}
                {day.rows.map((row) => (
                  <div key={row.id} className="rounded-md border border-fuel-line bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-black">{staff.find((person) => String(person.id) === String(row.staffId))?.name || "Staff"}</p>
                        <p className="mt-1 inline-flex rounded-md bg-fuel-mist px-2 py-1 text-sm font-black text-fuel-green">
                          {formatShiftRange(row.startTime, row.endTime)}
                        </p>
                        {row.notes && <p className="mt-2 truncate text-xs font-bold text-slate-600">{row.notes}</p>}
                      </div>
                      <button type="button" className="rounded-md bg-red-50 p-2 text-red-700" onClick={() => removeRow(row.id)} title="Remove">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-2 text-sm font-black text-fuel-ink">Ends after</p>
            <div className="flex flex-wrap gap-2">
              {durations.map((duration) => (
                <button
                  key={duration.value}
                  type="button"
                  className={`rounded-md px-4 py-2.5 text-sm font-black ${endMode === duration.value ? "bg-fuel-green text-white" : "bg-fuel-mist text-fuel-green"}`}
                  onClick={() => setEndMode(duration.value)}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </div>
          {endMode === "custom" && (
            <Field label="Custom end date">
              <input type="date" className={inputClass} value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
            </Field>
          )}
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-md border border-fuel-line bg-fuel-mist p-3 font-bold">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-fuel-green"
            checked={replaceGenerated}
            onChange={(event) => setReplaceGenerated(event.target.checked)}
          />
          <span>
            Replace existing generated pattern shifts in this date range
            <span className="block text-sm font-semibold text-slate-600">Manual one-off cover shifts are kept.</span>
          </span>
        </label>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 font-black text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-md bg-fuel-mist p-3 font-black text-fuel-green">{message}</p>}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <p className="text-sm font-bold text-slate-600">
            This will generate rota shifts until {endDate ? formatDateLabel(endDate) : "the selected end date"}.
          </p>
          <button type="button" className={darkButton} onClick={() => goTo("rota")}>
            <CalendarDays size={18} />
            Back to rota
          </button>
          <button type="button" className={primaryButton} onClick={submit} disabled={saving || loading}>
            <Wand2 size={18} />
            {saving ? "Generating..." : "Generate rota"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function previewEndDate(startDate, mode, customEndDate) {
  if (!startDate) return "";
  if (mode === "custom") return customEndDate;
  if (mode === "year") return `${startDate.slice(0, 4)}-12-31`;
  const months = { "1m": 1, "3m": 3, "6m": 6 }[mode] || 3;
  const date = new Date(`${startDate}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  date.setDate(date.getDate() - 1);
  return toDateInputValue(date);
}
