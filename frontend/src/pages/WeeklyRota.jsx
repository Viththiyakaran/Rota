import React from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, MessageCircle, Pencil, Printer, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { PageHeader, Pill, darkButton, primaryButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDateLabel, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappGroupShareUrl } from "../whatsapp.js";

export function WeeklyRota({ currentUser }) {
  const [startDate, setStartDate] = React.useState(toDateInputValue(getMonday()));
  const [staff, setStaff] = React.useState([]);
  const [shifts, setShifts] = React.useState([]);
  const [timeOff, setTimeOff] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [editingNoteId, setEditingNoteId] = React.useState(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [savingNoteId, setSavingNoteId] = React.useState(null);
  const [noteError, setNoteError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([api.week(startDate), api.timeOff(), api.staff(), api.tasks()])
      .then(([shiftRows, timeOffRows, staffRows, taskRows]) => {
        setShifts(shiftRows);
        setTimeOff(timeOffRows);
        setStaff(staffRows);
        setTasks(taskRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [startDate]);

  React.useEffect(() => {
    load();
  }, [load]);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(`${startDate}T00:00:00`), index);
    return toDateInputValue(date);
  });

  const removeShift = async (id) => {
    await api.deleteShift(id);
    load();
  };

  const startNoteEdit = (shift) => {
    setEditingNoteId(shift.id);
    setNoteDraft(shift.notes || "");
    setNoteError("");
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setNoteDraft("");
    setSavingNoteId(null);
    setNoteError("");
  };

  const saveNote = async (shift) => {
    setSavingNoteId(shift.id);
    setNoteError("");
    try {
      await api.updateShift(shift.id, { notes: noteDraft });
      setEditingNoteId(null);
      setNoteDraft("");
      await load();
    } catch (err) {
      setNoteError(err.message || "Could not save note.");
    } finally {
      setSavingNoteId(null);
    }
  };

  const moveWeek = (offset) => {
    const next = addDays(new Date(`${startDate}T00:00:00`), offset * 7);
    setStartDate(toDateInputValue(next));
  };

  const copyToNextWeek = async () => {
    setMessage("");
    const toStartDate = toDateInputValue(addDays(new Date(`${startDate}T00:00:00`), 7));
    const result = await api.copyWeek({ fromStartDate: startDate, toStartDate });
    setMessage(`${result.copied} shifts copied to next week.`);
  };

  const weekRange = `${formatDayLabel(weekDays[0])} - ${formatDayLabel(weekDays[6])}`;
  const visibleShifts = shifts.filter((shift) => !isApprovedOffShift(shift, timeOff, shift.shiftDate));
  const weekTasks = tasks.filter((task) =>
    task.status !== "done" &&
    task.dueDate &&
    task.dueDate >= weekDays[0] &&
    task.dueDate <= weekDays[6]
  );
  const activeStaff = staff.filter((person) => person.active);
  const groupShareUrl = whatsappGroupShareUrl({
    weekRange,
    weekDays,
    shifts: visibleShifts,
    formatDay: formatDayLabel,
    formatRange: formatShiftRange
  });
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="space-y-5">
      <PrintWeeklyRota
        activeStaff={activeStaff}
        timeOff={timeOff}
        tasks={weekTasks}
        visibleShifts={visibleShifts}
        weekDays={weekDays}
        weekRange={weekRange}
      />

      <div className="screen-only">
        <PageHeader
          eyebrow="Monday to Sunday"
          title="Weekly Rota"
          description={weekRange}
          meta={<Pill>{visibleShifts.length} shifts</Pill>}
        />
      </div>

      <div className="screen-only rounded-lg border border-fuel-line bg-white p-4 shadow-md">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center gap-2 font-black text-fuel-ink">
            <CalendarDays size={20} className="text-fuel-green" />
            Week start
          </div>
          <input
            type="date"
            className="w-full rounded-md border border-fuel-line bg-fuel-mist px-3 py-3 font-bold outline-none focus:border-fuel-green"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-fuel-mist text-fuel-green hover:bg-fuel-line"
              onClick={() => moveWeek(-1)}
              title="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => moveWeek(1)}
            >
              Next
              <ChevronRight size={18} className="ml-1 inline" />
            </button>
          </div>
          <div className="flex flex-col gap-2 lg:col-span-3 lg:flex-row">
            <a
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-black normal-case text-white shadow-sm"
              href={groupShareUrl}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              WhatsApp group
            </a>
            <button
              type="button"
              className={`flex-1 ${darkButton}`}
              onClick={() => window.print()}
            >
              <Printer size={18} />
              Print / PDF
            </button>
            {isAdmin && (
              <button
                type="button"
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-fuel-lime px-4 py-2.5 text-sm font-black normal-case text-fuel-ink shadow-sm"
                onClick={copyToNextWeek}
              >
                <Copy size={18} />
                Copy next week
              </button>
            )}
          </div>
        </div>
      </div>

      <Status loading={loading} error={error}>
        {message && <p className="rounded-md bg-fuel-mist p-3 font-black text-fuel-green">{message}</p>}
        <div className="screen-only grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
            const dayTimeOff = approvedTimeOffForDay(timeOff, day);
            const dayTasks = weekTasks.filter((task) => task.dueDate === day);
            return (
              <section key={day} className="flex min-h-[220px] flex-col overflow-hidden rounded-lg border border-fuel-line bg-white shadow-sm">
                <div className="border-b border-fuel-line bg-fuel-mist/70 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lg font-black leading-tight text-fuel-ink">{formatDayLabel(day)}</p>
                    <p className="text-xs font-black text-slate-500">{dayShifts.length}</p>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">{formatDateLabel(day)}</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {dayShifts.length === 0 && dayTimeOff.length === 0 && dayTasks.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-fuel-line bg-fuel-mist/30 p-4 text-sm font-bold text-slate-400">
                      No shifts
                    </div>
                  )}
                  {dayTasks.map((task) => (
                    <div key={`task-${task.id}`} className="rounded-md border border-fuel-line bg-fuel-mist/70 px-3 py-2">
                      <p className="text-xs font-black uppercase text-fuel-green">Task - {formatTaskStatus(task.status)}</p>
                      <p className="text-sm font-black text-fuel-ink">{task.title}</p>
                      {task.assignedStaffName && <p className="truncate text-xs font-bold text-slate-600">{task.assignedStaffName}</p>}
                    </div>
                  ))}
                  {dayTimeOff.map((request) => (
                    <div key={`time-off-${request.id}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-black uppercase text-amber-800">Time off approved</p>
                      <p className="text-sm font-black text-fuel-ink">{request.staffName || currentUser.staffName || "Staff"}</p>
                      {request.reason && <p className="truncate text-xs font-bold text-slate-600">{request.reason}</p>}
                    </div>
                  ))}
                  {dayShifts.map((shift) => (
                    <article key={shift.id} className={`rounded-md border bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] ${shift.isExtra ? "border-fuel-lime" : "border-fuel-line"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-black leading-tight text-fuel-ink">{shift.staffName}</p>
                            {shift.isExtra && (
                              <span className="rounded-full bg-fuel-lime px-2 py-0.5 text-[11px] font-black text-fuel-ink">
                                Extra
                              </span>
                            )}
                          </div>
                          <p className="mt-2 inline-flex rounded-md bg-fuel-mist px-2 py-1 text-sm font-black leading-none text-fuel-green">
                            {formatShiftRange(shift.startTime, shift.endTime)}
                          </p>
                          {shift.isExtra && shift.coverForStaffName && (
                            <p className="mt-2 truncate text-xs font-bold text-slate-600">Cover for {shift.coverForStaffName}</p>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            className="shrink-0 rounded-md bg-fuel-mist p-2 text-slate-500"
                            onClick={() => removeShift(shift.id)}
                            title="Delete shift"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 text-xs font-bold text-slate-600">
                        {shift.totalHours} hrs
                      </div>
                      <div className="mt-2">
                        {editingNoteId === shift.id ? (
                          <div className="space-y-2">
                            <textarea
                              className="min-h-20 w-full rounded-md border border-fuel-line bg-white px-3 py-2 text-sm font-bold outline-none focus:border-fuel-green"
                              value={noteDraft}
                              onChange={(event) => setNoteDraft(event.target.value)}
                              placeholder="Add note"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-green px-3 py-2 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70"
                                onClick={() => saveNote(shift)}
                                disabled={savingNoteId === shift.id}
                              >
                                <Check size={16} />
                                {savingNoteId === shift.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green disabled:opacity-60"
                                onClick={cancelNoteEdit}
                                disabled={savingNoteId === shift.id}
                              >
                                <X size={16} />
                                Cancel
                              </button>
                            </div>
                            {noteError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-black text-red-700">{noteError}</p>}
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            {shift.notes ? (
                              <p className="min-w-0 truncate rounded-md bg-fuel-mist px-2 py-1 text-xs font-bold text-slate-700">{shift.notes}</p>
                            ) : (
                              <p className="text-xs font-bold text-slate-400">No note</p>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                className="shrink-0 rounded-md bg-fuel-mist p-2 text-fuel-green"
                                title="Edit note"
                                onClick={() => startNoteEdit(shift)}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Status>
    </div>
  );
}

function PrintWeeklyRota({ activeStaff, timeOff, tasks, visibleShifts, weekDays, weekRange }) {
  return (
    <section className="print-only">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuel-green">Weekly rota</p>
          <h1 className="text-2xl font-black text-fuel-ink">Staff rota</h1>
          <p className="text-xs font-bold text-slate-600">{weekRange}</p>
        </div>
        <p className="text-xs font-black text-fuel-green">{visibleShifts.length} shifts</p>
      </div>
      <table className="print-rota-table">
        <thead>
          <tr>
            <th>Days</th>
            {activeStaff.map((person) => (
              <th key={person.id}>{person.name}</th>
            ))}
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {weekDays.map((day) => {
            const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
            const dayTimeOff = approvedTimeOffForDay(timeOff, day);
            const dayTasks = tasks.filter((task) => task.dueDate === day);
            const notes = [
              ...new Set([
                ...dayShifts.map((shift) => shift.notes).filter(Boolean),
                ...dayTimeOff.map((item) => `Time off: ${item.staffName || "Staff"}`),
                ...dayTasks.map(formatTaskNote)
              ])
            ];

            return (
              <tr key={day}>
                <td>
                  <strong>{formatPrintWeekday(day)}</strong>
                  <span>{formatDateLabel(day)}</span>
                </td>
                {activeStaff.map((person) => {
                  const personTimeOff = dayTimeOff.filter((item) => sameStaff(item.staffId, person.id));
                  const personShifts = personTimeOff.length > 0
                    ? []
                    : dayShifts.filter((shift) => sameStaff(shift.staffId, person.id));

                  return (
                    <td key={person.id}>
                      {personTimeOff.length > 0 ? (
                        <strong className="print-off">Approved off</strong>
                      ) : personShifts.length > 0 ? (
                        personShifts.map((shift) => (
                          <div key={shift.id} className="print-shift">
                            <strong>{formatShiftRange(shift.startTime, shift.endTime)}</strong>
                            {shift.isExtra && <span>Cover{shift.coverForStaffName ? ` for ${shift.coverForStaffName}` : ""}</span>}
                          </div>
                        ))
                      ) : (
                        <span className="print-muted">Off</span>
                      )}
                    </td>
                  );
                })}
                <td>{notes.join(", ")}</td>
              </tr>
            );
          })}
          <tr className="print-total-row">
            <td>Total Hours</td>
            {activeStaff.map((person) => {
              const total = visibleShifts
                .filter((shift) => sameStaff(shift.staffId, person.id))
                .reduce((sum, shift) => sum + shift.paidHours, 0);
              return <td key={person.id}>{Number.isInteger(total) ? total : total.toFixed(2)}</td>;
            })}
            <td />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function approvedTimeOffForDay(requests, day) {
  return requests.filter((request) =>
    request.status === "approved" &&
    request.endDate >= request.startDate &&
    day >= request.startDate &&
    day <= request.endDate
  );
}

function hasApprovedTimeOff(requests, staffId, day) {
  return requests.some((request) =>
    sameStaff(request.staffId, staffId) &&
    request.status === "approved" &&
    request.endDate >= request.startDate &&
    day >= request.startDate &&
    day <= request.endDate
  );
}

function isApprovedOffShift(shift, requests, day) {
  return Boolean(shift.approvedTimeOff) || hasApprovedTimeOff(requests, shift.staffId, day);
}

function sameStaff(left, right) {
  return String(left) === String(right);
}

function formatTaskStatus(status) {
  return {
    backlog: "Backlog",
    todo: "Todo",
    process: "Process",
    done: "Done"
  }[status] || "Task";
}

function formatTaskNote(task) {
  const assignee = task.assignedStaffName ? ` - ${task.assignedStaffName}` : "";
  return `Task (${formatTaskStatus(task.status)}): ${task.title}${assignee}`;
}

function formatPrintWeekday(dateString) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${dateString}T00:00:00`));
}
