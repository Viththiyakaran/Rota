import React from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Printer,
  Send,
  TriangleAlert,
  Trash2,
  X
} from "lucide-react";
import { api } from "../api.js";
import { Status } from "../components/Status.jsx";
import { StaffAvatar } from "../components/StaffAvatar.jsx";
import { addDays, formatDateLabel, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappGroupShareUrl } from "../whatsapp.js";

export function WeeklyRota({ currentUser, goTo, onAddShift, onEditShift }) {
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
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [publication, setPublication] = React.useState(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishMessage, setPublishMessage] = React.useState("");
  const [shiftToDelete, setShiftToDelete] = React.useState(null);
  const [deletingShift, setDeletingShift] = React.useState(false);
  const toolsRef = React.useRef(null);

  const load = React.useCallback(() => {
    setLoading(true);
    return Promise.all([
      api.week(startDate),
      api.timeOff(),
      api.staff(),
      api.tasks(),
      currentUser?.role === "admin" ? api.rotaPublication(startDate) : Promise.resolve(null)
    ])
      .then(([shiftRows, timeOffRows, staffRows, taskRows, publicationRow]) => {
        setShifts(shiftRows);
        setTimeOff(timeOffRows);
        setStaff(staffRows);
        setTasks(taskRows);
        setPublication(publicationRow);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [startDate, currentUser?.role]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!moreOpen) return undefined;

    const closeTools = (event) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      } else if (event.type === "mousedown" && !toolsRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", closeTools);
    document.addEventListener("keydown", closeTools);
    return () => {
      document.removeEventListener("mousedown", closeTools);
      document.removeEventListener("keydown", closeTools);
    };
  }, [moreOpen]);

  React.useEffect(() => {
    if (!shiftToDelete) return undefined;
    const closeDialog = (event) => {
      if (event.key === "Escape" && !deletingShift) setShiftToDelete(null);
    };
    document.addEventListener("keydown", closeDialog);
    return () => document.removeEventListener("keydown", closeDialog);
  }, [shiftToDelete, deletingShift]);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(`${startDate}T00:00:00`), index);
    return toDateInputValue(date);
  });

  const removeShift = async () => {
    if (!shiftToDelete) return;
    setDeletingShift(true);
    setError("");
    try {
      await api.deleteShift(shiftToDelete.id);
      setShiftToDelete(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not delete the shift.");
    } finally {
      setDeletingShift(false);
    }
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

  const goToCurrentWeek = () => setStartDate(toDateInputValue(getMonday()));

  const publishWeek = async () => {
    setPublishing(true);
    setPublishMessage("");
    setError("");
    try {
      const result = await api.publishRota(startDate);
      setPublishMessage(`${result.shifts} shifts published. Staff can now see the latest rota.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not publish the rota.");
    } finally {
      setPublishing(false);
    }
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
  const totalPaidHours = visibleShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);
  const today = toDateInputValue(new Date());

  return (
    <div className="space-y-3">
      <PrintWeeklyRota
        activeStaff={activeStaff}
        timeOff={timeOff}
        visibleShifts={visibleShifts}
        weekDays={weekDays}
        weekRange={weekRange}
      />

      <section className="screen-only overflow-visible rounded-xl border border-fuel-line bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 xl:grid xl:grid-cols-[auto_1fr_auto] xl:items-center">
          <div className="inline-flex w-fit items-center rounded-lg bg-slate-100 p-1">
            <span className="rounded-md bg-white px-4 py-2 text-sm font-black text-fuel-green shadow-sm">Week</span>
            <span className="px-4 py-2 text-sm font-bold text-slate-400">Staff view</span>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => moveWeek(-1)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-fuel-line bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-fuel-green"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 text-center">
              <h1 className="truncate text-lg font-black text-fuel-ink sm:text-xl">{weekRange}</h1>
              <p className="text-xs font-bold text-slate-500">Weekly staff schedule</p>
            </div>
            <button
              type="button"
              onClick={() => moveWeek(1)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-fuel-line bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-fuel-green"
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <label className="relative">
              <span className="sr-only">Jump to week</span>
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fuel-green" />
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 w-[145px] rounded-lg border border-fuel-line bg-white pl-8 pr-1 text-xs font-black text-fuel-ink outline-none focus:border-fuel-green focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={goToCurrentWeek}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-fuel-line bg-white px-3 text-sm font-black text-fuel-ink hover:bg-blue-50 hover:text-fuel-green"
            >
              Today
            </button>
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => onAddShift?.()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fuel-mist px-3 text-sm font-black text-fuel-green hover:bg-blue-100"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add shift
                </button>
                <button
                  type="button"
                  onClick={publishWeek}
                  disabled={publishing || (publication?.published && publication?.changes === 0)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fuel-green px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-default disabled:bg-emerald-100 disabled:text-emerald-700 disabled:shadow-none"
                >
                  {publication?.published && publication?.changes === 0 ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {publishing ? "Publishing..." : publication?.published && publication?.changes === 0 ? "Published" : "Publish rota"}
                </button>
              </>
            ) : null}

            <div ref={toolsRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fuel-mist px-3 text-sm font-black text-fuel-ink hover:bg-fuel-line"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
              >
                More
                <ChevronDown className={`h-4 w-4 transition ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              {moreOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-fuel-line bg-white p-2 shadow-xl"
                >
                  <a
                    href={groupShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <MessageCircle className="h-5 w-5 text-green-600" />
                    Share to WhatsApp
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      window.print();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Printer className="h-5 w-5 text-fuel-green" />
                    Print / PDF
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        goTo("rota-pattern");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold text-slate-800 hover:bg-slate-50"
                    >
                      <Layers className="h-5 w-5 text-fuel-green" />
                      Rota pattern
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-fuel-line bg-slate-50/80 px-4 py-2.5 text-xs font-bold text-slate-500">
          <span><strong className="text-fuel-ink">{activeStaff.length}</strong> staff</span>
          <span><strong className="text-fuel-ink">{visibleShifts.length}</strong> shifts</span>
          <span><strong className="text-fuel-ink">{formatHourTotal(totalPaidHours)}h</strong> paid</span>
          {isAdmin ? (
            <span className={`ml-auto flex items-center gap-2 font-black ${publication?.changes > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              <span className={`h-2 w-2 rounded-full ${publication?.changes > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
              {publication?.changes > 0
                ? `${publication.changes} unpublished ${publication.changes === 1 ? "change" : "changes"}`
                : publication?.published
                  ? "Staff rota is up to date"
                  : "Not published"}
            </span>
          ) : (
            <span className="ml-auto hidden items-center gap-2 text-fuel-green sm:flex">
              <span className={`h-2 w-2 rounded-full ${weekDays.includes(today) ? "bg-emerald-500" : "bg-slate-300"}`} />
              Published rota
            </span>
          )}
        </div>
      </section>

      {publishMessage && (
        <div className="screen-only flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          <Check className="h-4 w-4" />
          {publishMessage}
        </div>
      )}

      <Status loading={loading} error={error}>
        <PlannerGrid
          activeStaff={activeStaff}
          editingNoteId={editingNoteId}
          isAdmin={isAdmin}
          noteDraft={noteDraft}
          noteError={noteError}
          onAddShift={onAddShift}
          onCancelNote={cancelNoteEdit}
          onDeleteShift={setShiftToDelete}
          onEditShift={onEditShift}
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

      {shiftToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingShift) setShiftToDelete(null);
          }}
        >
          <section
            aria-labelledby="delete-shift-title"
            aria-describedby="delete-shift-description"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            role="dialog"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <TriangleAlert className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 id="delete-shift-title" className="text-xl font-black text-fuel-ink">Delete this shift?</h2>
                <p id="delete-shift-description" className="mt-1 text-sm font-medium leading-6 text-slate-500">
                  This removes the shift from the working rota. Staff will see the change after you publish the rota again.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-fuel-ink">{shiftToDelete.staffName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {formatDateLabel(shiftToDelete.shiftDate)} · {formatShiftRange(shiftToDelete.startTime, shiftToDelete.endTime)}
              </p>
              {shiftToDelete.notes && <p className="mt-2 text-sm font-medium text-slate-500">{shiftToDelete.notes}</p>}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                autoFocus
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setShiftToDelete(null)}
                disabled={deletingShift}
              >
                Keep shift
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                onClick={removeShift}
                disabled={deletingShift}
              >
                <Trash2 className="h-4 w-4" />
                {deletingShift ? "Deleting..." : "Delete shift"}
              </button>
            </div>
          </section>
        </div>
      )}
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
  onAddShift,
  onCancelNote,
  onDeleteShift,
  onEditShift,
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
    <section className="screen-only overflow-hidden rounded-xl border border-fuel-line bg-white shadow-sm">
      <MobileWeekCards
        editingNoteId={editingNoteId}
        isAdmin={isAdmin}
        noteDraft={noteDraft}
        noteError={noteError}
        onCancelNote={onCancelNote}
        onDeleteShift={onDeleteShift}
        onEditShift={onEditShift}
        onEditNote={onEditNote}
        onNoteDraftChange={onNoteDraftChange}
        onSaveNote={onSaveNote}
        savingNoteId={savingNoteId}
        tasks={tasks}
        timeOff={timeOff}
        visibleShifts={visibleShifts}
        weekDays={weekDays}
      />

      <div className="hidden max-h-[calc(100vh-11.5rem)] overflow-auto lg:block">
        <div className="min-w-[1060px]">
          <div className="sticky top-0 z-20 grid grid-cols-[210px_repeat(7,minmax(120px,1fr))] border-b border-fuel-line bg-white/95 shadow-sm backdrop-blur">
            <div className="sticky left-0 z-30 border-r border-fuel-line bg-white px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Team</p>
              <p className="mt-1 text-sm font-black text-fuel-ink">{formatHourTotal(totalHours)}h scheduled</p>
            </div>
            {weekDays.map((day) => {
              const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
              const dayHours = dayShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);
              const isToday = day === toDateInputValue(new Date());
              return (
                <div
                  key={day}
                  className={`relative border-r border-fuel-line px-3 py-3 last:border-r-0 ${
                    isToday ? "bg-blue-50" : "bg-white"
                  }`}
                >
                  {isToday && <span className="absolute inset-x-0 top-0 h-0.5 bg-fuel-green" />}
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-black ${isToday ? "text-fuel-green" : "text-fuel-ink"}`}>{formatCompactDayNumber(day)}</span>
                    <span className="truncate text-xs font-black text-slate-600">{formatCompactWeekday(day)}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {formatHourTotal(dayHours)}h · {dayShifts.length} {dayShifts.length === 1 ? "shift" : "shifts"}
                  </p>
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
                onAddShift={onAddShift}
                onCancelNote={onCancelNote}
                onDeleteShift={onDeleteShift}
                onEditShift={onEditShift}
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

function MobileWeekCards({
  editingNoteId,
  isAdmin,
  noteDraft,
  noteError,
  onCancelNote,
  onDeleteShift,
  onEditShift,
  onEditNote,
  onNoteDraftChange,
  onSaveNote,
  savingNoteId,
  tasks,
  timeOff,
  visibleShifts,
  weekDays
}) {
  return (
    <div className="space-y-3 p-3 lg:hidden">
      {weekDays.map((day) => {
        const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
        const dayTasks = tasks.filter((task) => task.dueDate === day);
        const dayTimeOff = approvedTimeOffForDay(timeOff, day);
        const dayHours = dayShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);

        return (
          <article key={day} className="rounded-xl border border-fuel-line bg-fuel-cream/80 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-fuel-ink">{formatDayLabel(day)}</h3>
                <p className="text-xs font-bold text-slate-500">{formatDateLabel(day)}</p>
              </div>
              <div className="text-right">
                <p className="rounded-md bg-white px-2 py-1 text-xs font-black text-fuel-green">{dayShifts.length} shifts</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{formatHourTotal(dayHours)} hrs</p>
              </div>
            </div>

            {dayTimeOff.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-black uppercase text-amber-700">Time off</p>
                <p className="text-sm font-bold text-slate-700">
                  {dayTimeOff.map((item) => item.staffName || "Staff").join(", ")}
                </p>
              </div>
            )}

            {dayShifts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-fuel-line bg-white px-3 py-6 text-center text-sm font-bold text-slate-400">
                No shifts planned
              </div>
            ) : (
              <div className="space-y-2">
                {dayShifts.map((shift) => (
                  <PlannerShiftCard
                    editingNoteId={editingNoteId}
                    isAdmin={isAdmin}
                    key={shift.id}
                    noteDraft={noteDraft}
                    noteError={noteError}
                    onCancelNote={onCancelNote}
                    onDeleteShift={onDeleteShift}
                    onEditShift={onEditShift}
                    onEditNote={onEditNote}
                    onNoteDraftChange={onNoteDraftChange}
                    onSaveNote={onSaveNote}
                    savingNoteId={savingNoteId}
                    shift={shift}
                    showStaffName
                  />
                ))}
              </div>
            )}

            {dayTasks.length > 0 && (
              <div className="mt-3 rounded-lg bg-white px-3 py-2">
                <p className="text-xs font-black uppercase text-slate-500">Tasks</p>
                <div className="mt-2 space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <p key={task.id} className="truncate text-sm font-bold text-fuel-ink">
                      {task.title}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function TasksRow({ tasks, weekDays }) {
  if (tasks.length === 0) return null;

  return (
    <div className="grid grid-cols-[210px_repeat(7,minmax(120px,1fr))] bg-white">
      <div className="sticky left-0 z-10 border-r border-fuel-line bg-white px-4 py-3">
        <p className="text-sm font-black text-fuel-ink">Open tasks</p>
        <p className="text-[11px] font-bold text-slate-400">{tasks.length} this week</p>
      </div>
      {weekDays.map((day) => {
        const dayTasks = tasks.filter((task) => task.dueDate === day);
        return (
          <div key={day} className="min-h-16 border-r border-fuel-line bg-slate-50/60 p-2 last:border-r-0">
            {dayTasks.length === 0 ? (
              <span className="sr-only">No tasks</span>
            ) : (
              <div className="space-y-1.5">
                {dayTasks.slice(0, 2).map((task) => (
                  <div key={task.id} className="rounded-md border border-fuel-line bg-white px-2 py-1.5 shadow-sm">
                    <p className="truncate text-xs font-black text-fuel-ink">{task.title}</p>
                    <p className="text-[10px] font-black uppercase text-fuel-green">{formatTaskStatus(task.status)}</p>
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
  onAddShift,
  onCancelNote,
  onDeleteShift,
  onEditShift,
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
    <div className="grid grid-cols-[210px_repeat(7,minmax(120px,1fr))] bg-white">
      <div className="sticky left-0 z-10 border-r border-fuel-line bg-white px-4 py-3 shadow-[6px_0_12px_rgba(15,23,42,0.035)]">
        <div className="flex items-start gap-3">
          <StaffAvatar avatarDataUrl={person.avatarDataUrl} className="h-9 w-9 text-sm" name={person.name} />
          <div className="min-w-0">
            <p className="truncate font-black text-fuel-ink">{person.name}</p>
            <p className="truncate text-[11px] font-bold text-slate-400">{person.role || "Staff"}</p>
            <p className="mt-1 text-[11px] font-black text-slate-600">
              {formatHourTotal(total)}h · {staffShifts.length} {staffShifts.length === 1 ? "shift" : "shifts"}
            </p>
          </div>
        </div>
      </div>

      {weekDays.map((day) => {
        const cellShifts = staffShifts.filter((shift) => shift.shiftDate === day);
        const dayTimeOff = approvedTimeOffForDay(timeOff, day).filter((item) => sameStaff(item.staffId, person.id));

        return (
          <div
            key={`${person.id}-${day}`}
            className={`min-h-24 border-r border-fuel-line p-1.5 last:border-r-0 ${
              day === toDateInputValue(new Date()) ? "bg-blue-50/70" : "bg-slate-50/45"
            }`}
          >
            {dayTimeOff.length > 0 ? (
              <div
                className="flex min-h-20 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-black uppercase text-amber-700"
                title={`${person.name} has approved time off on ${formatDateLabel(day)}`}
              >
                Time off
              </div>
            ) : cellShifts.length === 0 ? (
              isAdmin ? (
                <button
                  type="button"
                  onClick={() => onAddShift?.({ staffId: person.id, shiftDate: day })}
                  className="group flex h-full min-h-20 w-full items-center justify-center rounded-md text-slate-300 transition hover:bg-blue-50 hover:text-fuel-green focus:bg-blue-50 focus:text-fuel-green focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-200"
                  aria-label={`Add shift for ${person.name} on ${formatDateLabel(day)}`}
                >
                  <span className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                    <PlusCircle className="h-4 w-4" />
                    <span className="text-[11px] font-black">Add</span>
                  </span>
                </button>
              ) : (
                <div className="flex h-full min-h-20 items-center justify-center text-slate-300" aria-label="No shift">
                  —
                </div>
              )
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
                    onEditShift={onEditShift}
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
  onEditShift,
  onEditNote,
  onNoteDraftChange,
  onSaveNote,
  savingNoteId,
  shift,
  showStaffName = false
}) {
  const isEditing = editingNoteId === shift.id;
  const isLongShift = Number(shift.paidHours || shift.totalHours || 0) > 16.5;
  const openShift = (event) => {
    if (!isAdmin || isEditing || event.target.closest("button, summary, details, textarea")) return;
    onEditShift?.(shift);
  };

  return (
    <article
      className={`group/shift rounded-md border border-slate-200 border-l-[3px] bg-white p-2 shadow-sm transition ${
        shift.isExtra
          ? "border-l-emerald-500"
          : isLongShift
            ? "border-l-amber-500 bg-amber-50/30"
            : "border-l-fuel-green"
      } ${isAdmin && !isEditing ? "cursor-pointer hover:-translate-y-px hover:border-blue-200 hover:shadow-md" : ""}`}
      onClick={openShift}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && isAdmin && !isEditing) {
          event.preventDefault();
          onEditShift?.(shift);
        }
      }}
      role={isAdmin && !isEditing ? "button" : undefined}
      tabIndex={isAdmin && !isEditing ? 0 : undefined}
      title={isLongShift ? "Long shift — review the hours" : isAdmin ? "Click to edit shift" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showStaffName && <p className="truncate text-sm font-black text-fuel-ink">{shift.staffName}</p>}
          <p className="whitespace-nowrap text-[13px] font-black text-fuel-ink">{formatShiftRange(shift.startTime, shift.endTime)}</p>
          <p className={`mt-0.5 text-[11px] font-bold ${isLongShift ? "text-amber-700" : "text-slate-400"}`}>
            {shift.totalHours}h{isLongShift ? " · Review" : ""}
          </p>
        </div>
        {isAdmin && (
          <details className="relative shrink-0">
            <summary
              className="flex cursor-pointer list-none items-center justify-center rounded-md p-1 text-slate-400 opacity-40 transition hover:bg-fuel-mist hover:text-fuel-green hover:opacity-100 group-hover/shift:opacity-100 focus:opacity-100 [&::-webkit-details-marker]:hidden"
              aria-label="Shift actions"
            >
              <MoreHorizontal size={15} />
            </summary>
            <div className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-fuel-line bg-white p-1 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-black text-slate-700 hover:bg-fuel-mist"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onEditShift?.(shift);
                }}
              >
                <CalendarDays size={13} />
                Edit shift
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-black text-slate-700 hover:bg-fuel-mist"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onEditNote(shift);
                }}
              >
                <Pencil size={13} />
                Edit note
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-black text-red-700 hover:bg-red-50"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onDeleteShift(shift);
                }}
              >
                <Trash2 size={13} />
                Delete shift
              </button>
            </div>
          </details>
        )}
      </div>

      {shift.isExtra && (
        <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-800">
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
          <div>
            {shift.notes ? (
              <p className={`min-w-0 truncate rounded-md px-2 py-1 text-[10px] font-bold ${noteToneClass(shift.notes)}`} title={shift.notes}>{shift.notes}</p>
            ) : (
              <span className="sr-only">No note</span>
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
    todo: "To do",
    process: "Doing",
    done: "Done"
  }[status] || "Task";
}

function formatPrintWeekday(dateString) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${dateString}T00:00:00`));
}

function formatCompactWeekday(dateString) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${dateString}T00:00:00`));
}

function formatCompactDayNumber(dateString) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(new Date(`${dateString}T00:00:00`));
}
