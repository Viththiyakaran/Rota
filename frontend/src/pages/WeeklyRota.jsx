import React from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Layers, MessageCircle, Pencil, Printer, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { PageHeader, Pill, darkButton, primaryButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDateLabel, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappGroupShareUrl } from "../whatsapp.js";

export function WeeklyRota({ currentUser, goTo }) {
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
                onClick={() => goTo("rota-pattern")}
              >
                <Layers size={18} />
                Rota pattern
              </button>
            )}
          </div>
        </div>
      </div>

      <Status loading={loading} error={error}>
        <PlannerGrid
          activeStaff={activeStaff}
          editingNoteId={editingNoteId}
          isAdmin={isAdmin}
          noteDraft={noteDraft}
          noteError={noteError}
          onCancelNote={cancelNoteEdit}
          onDeleteShift={removeShift}
          onEditNote={startNoteEdit}
          onNoteDraftChange={setNoteDraft}
          onSaveNote={saveNote}
          savingNoteId={savingNoteId}
          tasks={weekTasks}
          timeOff={timeOff}
          visibleShifts={visibleShifts}
          weekDays={weekDays}
        />
      </Status>
    </div>
  );
}

function PrintWeeklyRota({ activeStaff, timeOff, visibleShifts, weekDays, weekRange }) {
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
            const notes = [
              ...new Set([
                ...dayShifts.map((shift) => shift.notes).filter(Boolean),
                ...dayTimeOff.map((item) => `Time off: ${item.staffName || "Staff"}`)
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

function PlannerGrid({
  activeStaff,
  editingNoteId,
  isAdmin,
  noteDraft,
  noteError,
  onCancelNote,
  onDeleteShift,
  onEditNote,
  onNoteDraftChange,
  onSaveNote,
  savingNoteId,
  tasks,
  timeOff,
  visibleShifts,
  weekDays
}) {
  const totalHours = visibleShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);

  return (
    <section className="screen-only overflow-hidden rounded-xl border border-fuel-line bg-white shadow-md">
      <div className="flex flex-col gap-3 border-b border-fuel-line bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-fuel-ink">Staff planner</h2>
          <p className="text-sm font-bold text-slate-600">
            {activeStaff.length} staff · {visibleShifts.length} shifts · {formatHourTotal(totalHours)} paid hours
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-600 sm:flex">
          <span className="rounded-md bg-fuel-mist px-3 py-2">Staff rows</span>
          <span className="rounded-md bg-fuel-mist px-3 py-2">Day columns</span>
          <span className="rounded-md bg-fuel-mist px-3 py-2">Scroll sideways</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[220px_repeat(7,minmax(126px,1fr))] border-b border-fuel-line bg-fuel-mist/80">
            <div className="sticky left-0 z-10 border-r border-fuel-line bg-fuel-mist/95 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Week summary</p>
              <p className="mt-1 text-sm font-black text-fuel-ink">{formatHourTotal(totalHours)} hrs</p>
            </div>
            {weekDays.map((day) => {
              const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
              const dayHours = dayShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);
              return (
                <div key={day} className="border-r border-fuel-line px-3 py-3 last:border-r-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-fuel-ink">{formatDayLabel(day)}</p>
                      <p className="text-xs font-bold text-slate-500">{formatDateLabel(day)}</p>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-fuel-green">
                      {dayShifts.length}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-600">{formatHourTotal(dayHours)} hrs</p>
                </div>
              );
            })}
          </div>

          <div className="divide-y divide-fuel-line">
            <TasksRow tasks={tasks} weekDays={weekDays} />
            {activeStaff.map((person) => (
              <StaffPlannerRow
                editingNoteId={editingNoteId}
                isAdmin={isAdmin}
                key={person.id}
                noteDraft={noteDraft}
                noteError={noteError}
                onCancelNote={onCancelNote}
                onDeleteShift={onDeleteShift}
                onEditNote={onEditNote}
                onNoteDraftChange={onNoteDraftChange}
                onSaveNote={onSaveNote}
                person={person}
                savingNoteId={savingNoteId}
                shifts={visibleShifts}
                timeOff={timeOff}
                weekDays={weekDays}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TasksRow({ tasks, weekDays }) {
  if (tasks.length === 0) return null;

  return (
    <div className="grid grid-cols-[220px_repeat(7,minmax(126px,1fr))] bg-white">
      <div className="sticky left-0 z-10 border-r border-fuel-line bg-white px-4 py-3">
        <p className="text-sm font-black text-fuel-ink">Tasks</p>
        <p className="text-xs font-bold text-slate-500">Not completed</p>
      </div>
      {weekDays.map((day) => {
        const dayTasks = tasks.filter((task) => task.dueDate === day);
        return (
          <div key={day} className="min-h-20 border-r border-fuel-line bg-fuel-cream/40 p-2 last:border-r-0">
            {dayTasks.length === 0 ? (
              <p className="text-xs font-bold text-slate-300">No tasks</p>
            ) : (
              <div className="space-y-2">
                {dayTasks.slice(0, 2).map((task) => (
                  <div key={task.id} className="rounded-md border border-fuel-line bg-white px-2 py-1.5">
                    <p className="truncate text-xs font-black text-fuel-ink">{task.title}</p>
                    <p className="text-[11px] font-black uppercase text-fuel-green">{formatTaskStatus(task.status)}</p>
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <p className="text-xs font-black text-slate-500">+{dayTasks.length - 2} more</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StaffPlannerRow({
  editingNoteId,
  isAdmin,
  noteDraft,
  noteError,
  onCancelNote,
  onDeleteShift,
  onEditNote,
  onNoteDraftChange,
  onSaveNote,
  person,
  savingNoteId,
  shifts,
  timeOff,
  weekDays
}) {
  const staffShifts = shifts.filter((shift) => sameStaff(shift.staffId, person.id));
  const total = staffShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);

  return (
    <div className="grid grid-cols-[220px_repeat(7,minmax(126px,1fr))] bg-white">
      <div className="sticky left-0 z-10 border-r border-fuel-line bg-white px-4 py-4 shadow-[6px_0_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuel-mist text-sm font-black text-fuel-green">
            {String(person.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-black text-fuel-ink">{person.name}</p>
            <p className="truncate text-xs font-bold text-slate-500">{person.role || "Staff"}</p>
            <p className="mt-1 text-xs font-black text-fuel-green">
              {formatHourTotal(total)} hrs · {staffShifts.length} shifts
            </p>
          </div>
        </div>
      </div>

      {weekDays.map((day) => {
        const cellShifts = staffShifts.filter((shift) => shift.shiftDate === day);
        const dayTimeOff = approvedTimeOffForDay(timeOff, day).filter((item) => sameStaff(item.staffId, person.id));

        return (
          <div key={`${person.id}-${day}`} className="min-h-28 border-r border-fuel-line bg-slate-50/40 p-2 last:border-r-0">
            {dayTimeOff.length > 0 && (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black uppercase text-amber-700">
                Approved off
              </div>
            )}
            {cellShifts.length === 0 ? (
              <div className="flex h-full min-h-20 items-center justify-center rounded-md border border-dashed border-fuel-line bg-white text-xs font-bold text-slate-300">
                Off
              </div>
            ) : (
              <div className="space-y-2">
                {cellShifts.map((shift) => (
                  <PlannerShiftCard
                    editingNoteId={editingNoteId}
                    isAdmin={isAdmin}
                    key={shift.id}
                    noteDraft={noteDraft}
                    noteError={noteError}
                    onCancelNote={onCancelNote}
                    onDeleteShift={onDeleteShift}
                    onEditNote={onEditNote}
                    onNoteDraftChange={onNoteDraftChange}
                    onSaveNote={onSaveNote}
                    savingNoteId={savingNoteId}
                    shift={shift}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlannerShiftCard({
  editingNoteId,
  isAdmin,
  noteDraft,
  noteError,
  onCancelNote,
  onDeleteShift,
  onEditNote,
  onNoteDraftChange,
  onSaveNote,
  savingNoteId,
  shift
}) {
  const isEditing = editingNoteId === shift.id;

  return (
    <article className={`rounded-md border-l-4 bg-white p-2 shadow-sm ${shift.isExtra ? "border-l-fuel-lime ring-1 ring-fuel-lime/50" : "border-l-fuel-green ring-1 ring-fuel-line"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-fuel-ink">{formatShiftRange(shift.startTime, shift.endTime)}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{shift.totalHours} hrs</p>
        </div>
        {isAdmin && (
          <button
            className="shrink-0 rounded-md bg-fuel-mist p-1.5 text-slate-500 hover:text-red-700"
            onClick={() => onDeleteShift(shift.id)}
            title="Delete shift"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {shift.isExtra && (
        <p className="mt-2 rounded-md bg-fuel-lime px-2 py-1 text-[11px] font-black text-fuel-ink">
          Extra{shift.coverForStaffName ? ` for ${shift.coverForStaffName}` : ""}
        </p>
      )}

      <div className="mt-2">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              className="min-h-20 w-full rounded-md border border-fuel-line bg-white px-2 py-2 text-xs font-bold outline-none focus:border-fuel-green"
              value={noteDraft}
              onChange={(event) => onNoteDraftChange(event.target.value)}
              placeholder="Add note"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="flex min-h-9 items-center justify-center gap-1 rounded-md bg-fuel-green px-2 py-1 text-xs font-black text-white disabled:cursor-wait disabled:opacity-70"
                onClick={() => onSaveNote(shift)}
                disabled={savingNoteId === shift.id}
              >
                <Check size={14} />
                {savingNoteId === shift.id ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                className="flex min-h-9 items-center justify-center gap-1 rounded-md bg-fuel-mist px-2 py-1 text-xs font-black text-fuel-green"
                onClick={onCancelNote}
                disabled={savingNoteId === shift.id}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
            {noteError && <p className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">{noteError}</p>}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            {shift.notes ? (
              <p className={`min-w-0 truncate rounded-md px-2 py-1 text-xs font-bold ${noteToneClass(shift.notes)}`}>{shift.notes}</p>
            ) : (
              <p className="text-xs font-bold text-slate-400">No note</p>
            )}
            {isAdmin && (
              <button
                type="button"
                className="shrink-0 rounded-md bg-fuel-mist p-1.5 text-fuel-green"
                title="Edit note"
                onClick={() => onEditNote(shift)}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function formatHourTotal(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function noteToneClass(note = "") {
  const text = String(note).toLowerCase();
  if (text.includes("clean")) return "bg-sky-50 text-sky-800";
  if (text.includes("shop")) return "bg-emerald-50 text-emerald-800";
  if (text.includes("cover") || text.includes("extra")) return "bg-fuel-lime text-fuel-ink";
  return "bg-slate-100 text-slate-700";
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

function formatPrintWeekday(dateString) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${dateString}T00:00:00`));
}
