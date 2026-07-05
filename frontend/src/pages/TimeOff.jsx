import React from "react";
import { Check, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, primaryButton, softButton, dangerButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { formatDateLabel, toDateInputValue } from "../dateUtils.js";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ukWeekdays = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" }
];

export function TimeOff({ currentUser }) {
  const isAdmin = currentUser.role === "admin";
  const [staff, setStaff] = React.useState([]);
  const [requests, setRequests] = React.useState([]);
  const [availability, setAvailability] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState("requests");
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

  const sortedRequests = [...requests].sort((a, b) => String(b.createdAt || b.startDate).localeCompare(String(a.createdAt || a.startDate)));
  const pendingRequests = sortedRequests.filter((request) => request.status === "pending");
  const historyRequests = sortedRequests.filter((request) => request.status !== "pending");
  const requestRows = tab === "history" ? historyRequests : pendingRequests;
  const pendingCount = pendingRequests.filter((request) => request.endDate >= request.startDate).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Leave and availability"
        title="Time Off"
        description="Manage requests and unavailable times before rota planning."
        meta={<Pill tone={pendingCount > 0 ? "lime" : "green"}>{pendingCount} pending</Pill>}
      />

      <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-1 shadow-soft ring-1 ring-fuel-line">
        {[
          ["requests", "Requests"],
          ["unavailable", "Unavailable Times"],
          ["history", "History"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === id ? "bg-fuel-green text-white shadow-sm" : "text-slate-600 hover:bg-fuel-mist hover:text-fuel-green"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Status loading={loading} error={error}>
        {tab === "requests" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_1.2fr]">
            <RequestForm isAdmin={isAdmin} staff={staff} form={timeOffForm} setForm={setTimeOffForm} onSubmit={requestTimeOff} />
            <RequestList requests={requestRows} isAdmin={isAdmin} currentUser={currentUser} onReview={review} emptyText="No pending requests." />
          </div>
        )}

        {tab === "unavailable" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_1.2fr]">
            <UnavailableForm isAdmin={isAdmin} staff={staff} form={availabilityForm} setForm={setAvailabilityForm} onSubmit={addAvailability} />
            <UnavailableList availability={availability} currentUser={currentUser} onRemove={removeAvailability} />
          </div>
        )}

        {tab === "history" && (
          <RequestList requests={requestRows} isAdmin={false} currentUser={currentUser} onReview={review} emptyText="No reviewed time-off requests yet." />
        )}
      </Status>
    </div>
  );
}

function RequestForm({ isAdmin, staff, form, setForm, onSubmit }) {
  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">New request</h3>
      <form className="space-y-3" onSubmit={onSubmit}>
        {isAdmin && (
          <Field label="Staff">
            <select className={inputClass} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date">
            <input type="date" className={inputClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })} />
          </Field>
          <Field label="End date">
            <input type="date" min={form.startDate} className={inputClass} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Reason">
          <textarea className={`${inputClass} min-h-24`} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <button className={`${primaryButton} w-full`}>Submit request</button>
      </form>
    </Card>
  );
}

function UnavailableForm({ isAdmin, staff, form, setForm, onSubmit }) {
  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">Add unavailable time</h3>
      <form className="space-y-3" onSubmit={onSubmit}>
        {isAdmin && (
          <Field label="Staff">
            <select className={inputClass} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Day">
          <select className={inputClass} value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
            {ukWeekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <input type="time" className={inputClass} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="time" className={inputClass} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Note">
          <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <button className={`${primaryButton} w-full`}>Add unavailable time</button>
      </form>
    </Card>
  );
}

function RequestList({ requests, isAdmin, currentUser, onReview, emptyText }) {
  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">Requests</h3>
      <div className="space-y-2">
        {requests.map((request) => {
          const invalidRange = request.endDate < request.startDate;
          const canReview = isAdmin && request.status === "pending" && !invalidRange;
          return (
            <div key={request.id} className="rounded-lg border border-fuel-line bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold">{request.staffName || currentUser.staffName || "Staff"}</p>
                  <p className="text-sm font-semibold text-slate-600">{formatDateLabel(request.startDate)} to {formatDateLabel(request.endDate)}</p>
                  <p className="mt-1 text-sm text-slate-700">{request.reason || "No reason added"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={statusClass(request.status)}>{invalidRange ? "Invalid date range" : request.status}</span>
                  {canReview && (
                    <>
                      <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-fuel-green text-white" onClick={() => onReview(request.id, "approved")} title="Approve"><Check size={16} /></button>
                      <button className={dangerButton} onClick={() => onReview(request.id, "rejected")} title="Reject"><X size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">{emptyText}</p>}
      </div>
    </Card>
  );
}

function UnavailableList({ availability, currentUser, onRemove }) {
  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">Unavailable list</h3>
      <div className="space-y-2">
        {availability.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-fuel-line bg-white p-3">
            <div>
              <p className="font-extrabold">{item.staffName || currentUser.staffName || "Staff"}</p>
              <p className="text-sm font-semibold text-slate-600">{weekdays[item.weekday]} {item.startTime}-{item.endTime}</p>
              {item.note && <p className="text-sm text-slate-700">{item.note}</p>}
            </div>
            <button className={softButton} onClick={() => onRemove(item.id)} title="Delete"><Trash2 size={16} /></button>
          </div>
        ))}
        {availability.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">No unavailable times yet.</p>}
      </div>
    </Card>
  );
}

function statusClass(status) {
  const base = "rounded-md px-2 py-1 text-xs font-black uppercase";
  if (status === "approved") return `${base} bg-fuel-mist text-fuel-green`;
  if (status === "rejected") return `${base} bg-red-50 text-red-700`;
  return `${base} bg-fuel-lime text-fuel-ink`;
}
