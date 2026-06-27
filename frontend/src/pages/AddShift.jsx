import React from "react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
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
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    staffId: "",
    shiftDate: toDateInputValue(new Date()),
    startTime: "05:30",
    endTime: "14:00",
    breakMinutes: 0,
    reminderMinutes: 60,
    notes: "",
    isExtra: false,
    coverForStaffId: ""
  });

  React.useEffect(() => {
    api.staff().then((rows) => {
      const active = rows.filter((person) => person.active);
      setStaff(active);
      setForm((current) => ({ ...current, staffId: active[0]?.id || "" }));
    });
  }, []);

  const selectedStaff = staff.find((person) => String(person.id) === String(form.staffId));

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
      <h2 className="text-3xl font-black">Add Shift</h2>
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
            <div className="rounded-md border border-fuel-line bg-white p-3">
              <p className="text-sm font-bold text-slate-600">Selected staff</p>
              <p className="text-xl font-black">{selectedStaff.name}</p>
              <p className="text-sm font-bold text-fuel-green">{selectedStaff.role}</p>
            </div>
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
              {quickRanges.map((range) => {
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
          <button className="w-full rounded-md bg-fuel-green py-4 text-lg font-black text-white">Save Shift</button>
        </form>
      </Card>
    </div>
  );
}
