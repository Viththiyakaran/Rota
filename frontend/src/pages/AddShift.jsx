import React from "react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, primaryButton } from "../components/PageHeader.jsx";
import { toDateInputValue } from "../dateUtils.js";

const quickRanges = [
  { label: "5.30am-2pm", startTime: "05:30", endTime: "14:00" },
  { label: "5.30am-7pm", startTime: "05:30", endTime: "19:00" },
  { label: "5.30am-10pm", startTime: "05:30", endTime: "22:00" },
  { label: "1pm-10pm", startTime: "13:00", endTime: "22:00" },
  { label: "2pm-10pm", startTime: "14:00", endTime: "22:00" },
  { label: "6pm-10pm", startTime: "18:00", endTime: "22:00" }
];

export function AddShift({ onSaved }) {
  const [staff, setStaff] = React.useState([]);
  const [openingHours, setOpeningHours] = React.useState({ openingStart: "05:30", openingEnd: "22:00" });
  const [availability, setAvailability] = React.useState([]);
  const [timeOff, setTimeOff] = React.useState([]);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    staffId: "",
    shiftDate: toDateInputValue(new Date()),
    startTime: "05:30",
    endTime: "14:00",
    breakMinutes: 0,
    reminderMinutes: 30,
    notes: "",
    isExtra: false,
    coverForStaffId: ""
  });

  React.useEffect(() => {
    Promise.all([api.staff(), api.openingHours(), api.availability(), api.timeOff()]).then(([rows, hours, availabilityRows, timeOffRows]) => {
      const active = rows.filter((person) => person.active);
      setStaff(active);
      setOpeningHours(hours);
      setAvailability(availabilityRows);
      setTimeOff(timeOffRows);
      setForm((current) => ({
        ...current,
        staffId: active[0]?.id || "",
        startTime: hours.openingStart,
        endTime: hours.openingEnd
      }));
    });
  }, []);

  const selectedStaff = staff.find((person) => String(person.id) === String(form.staffId));
  const dynamicRanges = buildRanges(openingHours);
  const conflict = findConflict(form, availability, timeOff);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.createShift({
        ...form,
        staffId: Number(form.staffId),
        coverForStaffId: form.isExtra && form.coverForStaffId ? Number(form.coverForStaffId) : null
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Rota"
        title="One-off Shift"
        description="Use this for temporary cover or changes. For normal repeating rota, use Rota Pattern."
      />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p>}
          <Field label="Staff">
            <select required className={inputClass} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>{person.name} - {person.role}</option>
              ))}
            </select>
          </Field>
          {selectedStaff && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-fuel-line bg-fuel-mist/60 p-3">
              <p className="text-sm font-bold text-slate-600">Selected staff</p>
              <div className="text-right">
                <p className="text-lg font-black">{selectedStaff.name}</p>
                <Pill>{selectedStaff.role}</Pill>
              </div>
            </div>
          )}
          {conflict && (
            <p className="rounded-md bg-amber-50 p-3 text-sm font-black text-amber-800">
              Warning: {conflict}
            </p>
          )}
          <label className="flex items-center gap-3 rounded-md border border-fuel-line bg-fuel-mist p-3 font-bold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-fuel-green"
              checked={form.isExtra}
              onChange={(e) => setForm({ ...form, isExtra: e.target.checked, coverForStaffId: e.target.checked ? form.coverForStaffId : "" })}
            />
            Extra cover shift
          </label>
          {form.isExtra && (
            <Field label="Covering for">
              <select
                className={inputClass}
                value={form.coverForStaffId}
                onChange={(e) => setForm({ ...form, coverForStaffId: e.target.value })}
              >
                <option value="">Select staff off</option>
                {staff
                  .filter((person) => String(person.id) !== String(form.staffId))
                  .map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="Date">
            <input type="date" required className={inputClass} value={form.shiftDate} onChange={(e) => setForm({ ...form, shiftDate: e.target.value })} />
          </Field>
          <div className="rounded-md border border-fuel-line bg-fuel-mist p-3">
            <p className="mb-3 text-sm font-black text-fuel-ink">Hour range</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {dynamicRanges.map((range) => {
                const isSelected = form.startTime === range.startTime && form.endTime === range.endTime;
                return (
                  <button
                    key={range.label}
                    type="button"
                    className={`rounded-md px-3 py-3 text-sm font-black ring-2 ring-transparent ${
                      isSelected
                        ? "bg-fuel-green text-white ring-fuel-lime"
                        : "bg-white text-fuel-green"
                    }`}
                    onClick={() => setForm({ ...form, startTime: range.startTime, endTime: range.endTime })}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Notes">
            <textarea className={`${inputClass} min-h-24`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <button className={`${primaryButton} w-full`}>Save One-off Shift</button>
        </form>
      </Card>
    </div>
  );
}

function buildRanges(hours) {
  const ranges = [
    { label: `${hours.openingStart}-${hours.openingEnd}`, startTime: hours.openingStart, endTime: hours.openingEnd },
    ...quickRanges
  ];
  return ranges.filter((range, index, list) => index === list.findIndex((item) => item.startTime === range.startTime && item.endTime === range.endTime));
}

function findConflict(form, availability, timeOff) {
  const staffId = Number(form.staffId);
  if (!staffId || !form.shiftDate) return "";
  const weekday = new Date(`${form.shiftDate}T00:00:00`).getDay();
  const unavailable = availability.find((item) => Number(item.staffId) === staffId && Number(item.weekday) === weekday);
  if (unavailable) return `staff marked unavailable on this day${unavailable.note ? ` (${unavailable.note})` : ""}.`;
  const approvedOff = timeOff.find((item) => Number(item.staffId) === staffId && item.status === "approved" && form.shiftDate >= item.startDate && form.shiftDate <= item.endDate);
  if (approvedOff) return "staff has approved time off on this date.";
  return "";
}
