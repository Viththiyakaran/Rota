import React from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, MessageCircle, Pencil, Printer, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { Status } from "../components/Status.jsx";
import { addDays, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappGroupShareUrl } from "../whatsapp.js";

export function WeeklyRota({ currentUser }) {
  const [startDate, setStartDate] = React.useState(toDateInputValue(getMonday()));
  const [shifts, setShifts] = React.useState([]);
  const [timeOff, setTimeOff] = React.useState([]);
  const [editingNoteId, setEditingNoteId] = React.useState(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([api.week(startDate), api.timeOff()])
      .then(([shiftRows, timeOffRows]) => {
        setShifts(shiftRows);
        setTimeOff(timeOffRows);
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
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setNoteDraft("");
  };

  const saveNote = async (shift) => {
    await api.updateShift(shift.id, { notes: noteDraft });
    setEditingNoteId(null);
    setNoteDraft("");
    load();
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
  const visibleShifts = shifts.filter((shift) => !hasApprovedTimeOff(timeOff, shift.staffId, shift.shiftDate));
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-fuel-green">Monday to Sunday</p>
          <h2 className="text-3xl font-black text-fuel-ink">Weekly Rota</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{weekRange}</p>
        </div>
        <div className="rounded-md border border-fuel-line bg-white px-4 py-3 text-sm font-black text-fuel-green">
          {visibleShifts.length} shifts
        </div>
      </div>

      <div className="rounded-md border border-fuel-line bg-white p-3 shadow-soft">
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
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
          <button
            className="flex items-center justify-center gap-2 rounded-md bg-fuel-mist px-4 py-3 font-black text-fuel-green"
            onClick={() => moveWeek(-1)}
          >
            <ChevronLeft size={18} />
            Prev
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-md bg-fuel-green px-4 py-3 font-black text-white"
            onClick={() => moveWeek(1)}
          >
            Next
            <ChevronRight size={18} />
          </button>
          <a
            className="flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 font-black text-white sm:col-span-4"
            href={groupShareUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            Share weekly rota to WhatsApp group
          </a>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-md bg-fuel-ink px-4 py-3 font-black text-white sm:col-span-2"
            onClick={() => window.print()}
          >
            <Printer size={18} />
            Print / PDF
          </button>
          {isAdmin && (
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-md bg-fuel-lime px-4 py-3 font-black text-fuel-ink sm:col-span-2"
              onClick={copyToNextWeek}
            >
              <Copy size={18} />
              Copy to next week
            </button>
          )}
        </div>
      </div>

      <Status loading={loading} error={error}>
        {message && <p className="rounded-md bg-fuel-mist p-3 font-black text-fuel-green">{message}</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
            const dayTimeOff = approvedTimeOffForDay(timeOff, day);
            return (
              <section key={day} className="flex min-h-[280px] flex-col rounded-md border border-fuel-line bg-white shadow-soft">
                <div className="border-b border-fuel-line bg-fuel-mist px-4 py-3">
                  <p className="text-lg font-black text-fuel-ink">{formatDayLabel(day)}</p>
                  <p className="text-xs font-bold text-slate-500">{day}</p>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  {dayShifts.length === 0 && dayTimeOff.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-fuel-line bg-white p-4 text-sm font-bold text-slate-400">
                      No shifts
                    </div>
                  )}
                  {dayTimeOff.map((request) => (
                    <div key={`time-off-${request.id}`} className="rounded-md border border-red-100 bg-red-50 p-3">
                      <p className="text-sm font-black uppercase text-red-700">Approved time off</p>
                      <p className="font-black text-fuel-ink">{request.staffName || currentUser.staffName || "Staff"}</p>
                      {request.reason && <p className="text-sm font-bold text-slate-600">{request.reason}</p>}
                    </div>
                  ))}
                  {dayShifts.map((shift) => (
                    <article key={shift.id} className="rounded-md border border-fuel-line bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black text-fuel-ink">{shift.staffName}</p>
                            {shift.isExtra && (
                              <span className="rounded-md bg-fuel-lime px-2 py-1 text-xs font-black text-fuel-ink">
                                Extra
                              </span>
                            )}
                          </div>
                          <p className="mt-2 inline-flex rounded-md bg-fuel-mist px-2 py-1 text-sm font-black text-fuel-green">
                            {formatShiftRange(shift.startTime, shift.endTime)}
                          </p>
                          {shift.isExtra && shift.coverForStaffName && (
                            <p className="mt-2 text-xs font-bold text-slate-600">Cover for {shift.coverForStaffName}</p>
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
                      <div className="mt-3 text-sm text-fuel-ink">
                        <p><span className="font-bold">{shift.totalHours}</span> hrs</p>
                      </div>
                      <div className="mt-3">
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
                                className="flex items-center justify-center gap-2 rounded-md bg-fuel-green px-3 py-2 text-sm font-black text-white"
                                onClick={() => saveNote(shift)}
                              >
                                <Check size={16} />
                                Save
                              </button>
                              <button
                                type="button"
                                className="flex items-center justify-center gap-2 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green"
                                onClick={cancelNoteEdit}
                              >
                                <X size={16} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            {shift.notes ? (
                              <p className="rounded-md bg-fuel-mist px-2 py-1 text-sm font-bold text-slate-700">{shift.notes}</p>
                            ) : (
                              <p className="text-sm font-bold text-slate-400">No note</p>
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
    request.staffId === staffId &&
    request.status === "approved" &&
    request.endDate >= request.startDate &&
    day >= request.startDate &&
    day <= request.endDate
  );
}
