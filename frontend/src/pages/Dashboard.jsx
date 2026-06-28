import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Info, MessageCircle, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Dashboard({ goTo, currentUser, branding }) {
  const [staff, setStaff] = React.useState([]);
  const [shifts, setShifts] = React.useState([]);
  const [reminders, setReminders] = React.useState([]);
  const [timeOff, setTimeOff] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dashboardWeekStart, setDashboardWeekStart] = React.useState(toDateInputValue(getMonday()));

  React.useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.staff(),
      api.week(dashboardWeekStart),
      api.reminders(),
      api.timeOff()
    ])
      .then(([staffResult, shiftResult, reminderResult, timeOffResult]) => {
        if (staffResult.status === "fulfilled") setStaff(staffResult.value);
        if (shiftResult.status === "fulfilled") setShifts(shiftResult.value);
        if (reminderResult.status === "fulfilled") setReminders(reminderResult.value);
        if (timeOffResult.status === "fulfilled") setTimeOff(timeOffResult.value);
        const failed = [staffResult, shiftResult, reminderResult, timeOffResult].find((result) => result.status === "rejected");
        if (failed) setError(failed.reason.message);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dashboardWeekStart]);

  const activeStaff = staff.filter((person) => person.active).length;
  const isAdmin = currentUser?.role === "admin";
  const weekStart = new Date(`${dashboardWeekStart}T00:00:00`);
  const weekDays = Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(weekStart, index)));
  const weekRange = `${formatDayLabel(weekDays[0])} - ${formatDayLabel(weekDays[6])}`;
  const moveDashboardWeek = (weeks) => {
    setDashboardWeekStart(toDateInputValue(addDays(weekStart, weeks * 7)));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-fuel-line bg-white p-5 shadow-soft">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-fuel-green">Today</p>
        <h2 className="mt-1 text-3xl font-black text-fuel-ink">{branding.appTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
          Weekly rota, cover shifts, and reminders in one place.
        </p>
      </div>

      {error && !loading && (
        <p className="rounded-md bg-amber-50 p-3 font-bold text-amber-800">
          Some dashboard data could not load: {error}
        </p>
      )}

      <Status loading={loading} error="">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Active staff" value={activeStaff} />
          <Metric icon={CalendarDays} label="Shifts this week" value={shifts.length} />
          <Metric icon={MessageCircle} label="Reminders" value={reminders.length} />
          <Metric icon={CalendarDays} label="Week days" value="7" />
        </div>

        <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {isAdmin && (
            <button onClick={() => goTo("add-staff")} className="rounded-md bg-fuel-green px-5 py-4 font-black text-white shadow-lift transition hover:bg-fuel-deep">
              Add Staff
            </button>
          )}
          {isAdmin && (
            <button onClick={() => goTo("add-shift")} className="rounded-md bg-fuel-ink px-5 py-4 font-black text-white shadow-soft transition hover:bg-fuel-deep">
              Add Shift
            </button>
          )}
          <button onClick={() => goTo("rota")} className="rounded-md bg-fuel-lime px-5 py-4 font-black text-fuel-ink shadow-soft transition hover:bg-fuel-gold">
            Weekly Rota
          </button>
          {!isAdmin && (
            <button onClick={() => goTo("reminders")} className="rounded-md bg-fuel-green px-5 py-4 font-black text-white shadow-lift transition hover:bg-fuel-deep">
              My Reminders
            </button>
          )}
        </div>

        <Card>
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black">Rota calendar</h3>
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fuel-mist text-fuel-green outline-none ring-fuel-green transition hover:bg-fuel-green hover:text-white focus:ring-2"
                    aria-label="Rota calendar information"
                  >
                    <Info size={16} />
                  </button>
                  <span className="pointer-events-none absolute left-1/2 top-9 z-20 hidden w-64 -translate-x-1/2 rounded-md bg-fuel-ink px-3 py-2 text-xs font-bold text-white shadow-lift group-hover:block group-focus-within:block">
                    Hover a day cell to review rota notes, extra cover, and approved time off.
                  </span>
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-600">{weekRange}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-ink"
                onClick={() => moveDashboardWeek(-1)}
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-ink"
                onClick={() => moveDashboardWeek(1)}
              >
                Next
                <ChevronRight size={16} />
              </button>
              <button className="rounded-md px-3 py-2 text-sm font-bold text-fuel-green" onClick={() => goTo("rota")}>
                Open week
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Days</th>
                  {staff.filter((person) => person.active).map((person) => (
                    <th key={person.id} className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">
                      {person.name}
                    </th>
                  ))}
                  <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Notes</th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map((day) => {
                  const dayShifts = shifts.filter((shift) => shift.shiftDate === day);
                  const visibleDayShifts = dayShifts.filter((shift) => !isApprovedOffShift(shift, timeOff, day));
                  const dayTimeOff = approvedTimeOffForDay(timeOff, day);
                  const dayNotes = [
                    ...new Set([
                      ...visibleDayShifts.map((shift) => shift.notes).filter(Boolean),
                      ...dayTimeOff.map((item) => `Time off: ${item.staffName || "Staff"}`)
                    ])
                  ];
                  return (
                    <tr key={day}>
                      <td className="border border-fuel-line px-3 py-3 font-bold">{formatWeekday(day)}</td>
                      {staff.filter((person) => person.active).map((person) => {
                        const personTimeOff = dayTimeOff.filter((item) => sameStaff(item.staffId, person.id));
                        const personShifts = personTimeOff.length > 0
                          ? []
                          : visibleDayShifts.filter((shift) => sameStaff(shift.staffId, person.id));
                        return (
                          <td key={person.id} className="border border-fuel-line px-3 py-3">
                            {personShifts.length > 0 || personTimeOff.length > 0 ? (
                              <div className="space-y-2">
                                {personTimeOff.length > 0 && (
                                  <p className="rounded-md bg-red-50 px-2 py-1 text-xs font-black uppercase text-red-700">
                                    Approved time off
                                  </p>
                                )}
                                {personShifts.map((personShift) => (
                                  <div key={personShift.id} className="space-y-1">
                                    <p className="font-bold text-fuel-green">
                                      {formatShiftRange(personShift.startTime, personShift.endTime)}
                                    </p>
                                    {personShift.isExtra && (
                                      <p className="rounded-md bg-fuel-lime px-2 py-1 text-xs font-black text-fuel-ink">
                                        Extra cover{personShift.coverForStaffName ? ` for ${personShift.coverForStaffName}` : ""}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">Off</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-fuel-line px-3 py-3 font-bold">{dayNotes.join(", ")}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="border border-fuel-line bg-fuel-mist px-3 py-3 font-black">Total Hours</td>
                  {staff.filter((person) => person.active).map((person) => {
                    const total = shifts
                      .filter((shift) => sameStaff(shift.staffId, person.id) && !isApprovedOffShift(shift, timeOff, shift.shiftDate))
                      .reduce((sum, shift) => sum + shift.paidHours, 0);
                    return (
                      <td key={person.id} className="border border-fuel-line bg-fuel-mist px-3 py-3 font-black">
                        {Number.isInteger(total) ? total : total.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="border border-fuel-line bg-fuel-mist px-3 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black">Upcoming reminders</h3>
            <button className="text-sm font-bold text-fuel-green" onClick={() => goTo("reminders")}>
              View all
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reminders.slice(0, 4).map((reminder) => (
              <div key={reminder.id} className="rounded-md bg-fuel-mist p-3">
                <p className="truncate font-black">{reminder.staffName}</p>
                <p className="mt-1 text-sm text-slate-700">{reminder.reminderMessage}</p>
                {reminder.isExtra && (
                  <p className="mt-1 text-xs font-black text-fuel-green">
                    Extra cover{reminder.coverForStaffName ? ` for ${reminder.coverForStaffName}` : ""}
                  </p>
                )}
                {whatsappReminderUrl(reminder) && (
                  <a
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-black text-white"
                    href={whatsappReminderUrl(reminder)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      </Status>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-600">{label}</p>
          <p className="mt-2 text-4xl font-black text-fuel-ink">{value}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-fuel-mist text-fuel-green">
          <Icon size={26} />
        </span>
      </div>
    </Card>
  );
}

function formatWeekday(dateString) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${dateString}T00:00:00`));
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
