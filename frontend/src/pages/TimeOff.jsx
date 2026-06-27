import React from "react";
import { Check, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { Status } from "../components/Status.jsx";
import { toDateInputValue } from "../dateUtils.js";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TimeOff({ currentUser }) {
  const isAdmin = currentUser.role === "admin";
  const [staff, setStaff] = React.useState([]);
  const [requests, setRequests] = React.useState([]);
  const [availability, setAvailability] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [timeOffForm, setTimeOffForm] = React.useState({
    staffId: "",
    startDate: toDateInputValue(new Date()),
    endDate: toDateInputValue(new Date()),
    reason: ""
  });
  const [availabilityForm, setAvailabilityForm] = React.useState({
    staffId: "",
    weekday: 1,
    startTime: "00:00",
    endTime: "23:59",
    note: ""
  });

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([isAdmin ? api.staff() : Promise.resolve([]), api.timeOff(), api.availability()])
      .then(([staffRows, timeOffRows, availabilityRows]) => {
        const activeStaff = staffRows.filter?.((person) => person.active) || [];
        setStaff(activeStaff);
        setRequests(timeOffRows);
        setAvailability(availabilityRows);
        setTimeOffForm((current) => ({ ...current, staffId: current.staffId || activeStaff[0]?.id || "" }));
        setAvailabilityForm((current) => ({ ...current, staffId: current.staffId || activeStaff[0]?.id || "" }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  React.useEffect(() => {
    load();
  }, [load]);

  const requestTimeOff = async (event) => {
    event.preventDefault();
    setError("");
    if (timeOffForm.endDate < timeOffForm.startDate) {
      setError("End date cannot be before start date.");
      return;
    }
    try {
      await api.createTimeOff(timeOffForm);
      setTimeOffForm((current) => ({ ...current, reason: "" }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const addAvailability = async (event) => {
    event.preventDefault();
    await api.createAvailability(availabilityForm);
    setAvailabilityForm((current) => ({ ...current, note: "" }));
    load();
  };

  const review = async (id, status) => {
    await api.updateTimeOff(id, { status });
    load();
  };

  const removeAvailability = async (id) => {
    await api.deleteAvailability(id);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-black">Time Off & Availability</h2>
      <Status loading={loading} error={error}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-xl font-black">Request Time Off</h3>
            <form className="space-y-3" onSubmit={requestTimeOff}>
              {isAdmin && (
                <Field label="Staff">
                  <select className={inputClass} value={timeOffForm.staffId} onChange={(e) => setTimeOffForm({ ...timeOffForm, staffId: e.target.value })}>
                    {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </Field>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start date">
                  <input
                    type="date"
                    className={inputClass}
                    value={timeOffForm.startDate}
                    onChange={(e) => setTimeOffForm({
                      ...timeOffForm,
                      startDate: e.target.value,
                      endDate: timeOffForm.endDate < e.target.value ? e.target.value : timeOffForm.endDate
                    })}
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    min={timeOffForm.startDate}
                    className={inputClass}
                    value={timeOffForm.endDate}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Reason">
                <textarea className={`${inputClass} min-h-20`} value={timeOffForm.reason} onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })} />
              </Field>
              <button className="w-full rounded-md bg-fuel-green px-5 py-4 font-black text-white">Submit Request</button>
            </form>
          </Card>

          <Card>
            <h3 className="mb-3 text-xl font-black">Unavailable Times</h3>
            <form className="space-y-3" onSubmit={addAvailability}>
              {isAdmin && (
                <Field label="Staff">
                  <select className={inputClass} value={availabilityForm.staffId} onChange={(e) => setAvailabilityForm({ ...availabilityForm, staffId: e.target.value })}>
                    {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Day">
                <select className={inputClass} value={availabilityForm.weekday} onChange={(e) => setAvailabilityForm({ ...availabilityForm, weekday: Number(e.target.value) })}>
                  {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From">
                  <input type="time" className={inputClass} value={availabilityForm.startTime} onChange={(e) => setAvailabilityForm({ ...availabilityForm, startTime: e.target.value })} />
                </Field>
                <Field label="To">
                  <input type="time" className={inputClass} value={availabilityForm.endTime} onChange={(e) => setAvailabilityForm({ ...availabilityForm, endTime: e.target.value })} />
                </Field>
              </div>
              <Field label="Note">
                <input className={inputClass} value={availabilityForm.note} onChange={(e) => setAvailabilityForm({ ...availabilityForm, note: e.target.value })} />
              </Field>
              <button className="w-full rounded-md bg-fuel-ink px-5 py-4 font-black text-white">Add Unavailable Time</button>
            </form>
          </Card>
        </div>

        <Card>
          <h3 className="mb-3 text-xl font-black">Time-Off Requests</h3>
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="rounded-md border border-fuel-line bg-white p-3">
                <p className="font-black">{request.staffName || currentUser.staffName || "Staff"}</p>
                <p className="text-sm font-bold text-slate-600">{request.startDate} to {request.endDate}</p>
                {request.endDate < request.startDate && (
                  <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs font-black uppercase text-red-700">
                    Invalid date range
                  </p>
                )}
                <p className="text-sm">{request.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-fuel-mist px-2 py-1 text-xs font-black uppercase text-fuel-green">{request.status}</span>
                  {isAdmin && (
                    <>
                      <button className="rounded-md bg-fuel-green p-2 text-white" onClick={() => review(request.id, "approved")} title="Approve"><Check size={16} /></button>
                      <button className="rounded-md bg-red-100 p-2 text-red-700" onClick={() => review(request.id, "rejected")} title="Reject"><X size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {requests.length === 0 && <p className="text-sm font-bold text-slate-500">No time-off requests yet.</p>}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-xl font-black">Unavailable List</h3>
          <div className="space-y-2">
            {availability.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-fuel-line bg-white p-3">
                <div>
                  <p className="font-black">{item.staffName || currentUser.staffName || "Staff"}</p>
                  <p className="text-sm font-bold text-slate-600">{weekdays[item.weekday]} {item.startTime}-{item.endTime}</p>
                  {item.note && <p className="text-sm">{item.note}</p>}
                </div>
                <button className="rounded-md bg-fuel-mist p-2 text-slate-500" onClick={() => removeAvailability(item.id)} title="Delete"><Trash2 size={16} /></button>
              </div>
            ))}
            {availability.length === 0 && <p className="text-sm font-bold text-slate-500">No unavailable times yet.</p>}
          </div>
        </Card>
      </Status>
    </div>
  );
}
