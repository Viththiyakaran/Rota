import React from "react";
import { Bot, CalendarDays, ChevronLeft, ChevronRight, Info, Layers, ListChecks, MessageCircle, PlusCircle, Settings, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { PageHeader, darkButton, primaryButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Dashboard({ goTo, currentUser, branding }) {
  const [staff, setStaff] = React.useState([]);
  const [shifts, setShifts] = React.useState([]);
  const [reminders, setReminders] = React.useState([]);
  const [timeOff, setTimeOff] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
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
      api.timeOff(),
      api.tasks()
    ])
      .then(([staffResult, shiftResult, reminderResult, timeOffResult, taskResult]) => {
        if (staffResult.status === "fulfilled") setStaff(staffResult.value);
        if (shiftResult.status === "fulfilled") setShifts(shiftResult.value);
        if (reminderResult.status === "fulfilled") setReminders(reminderResult.value);
        if (timeOffResult.status === "fulfilled") setTimeOff(timeOffResult.value);
        if (taskResult.status === "fulfilled") setTasks(taskResult.value);
        const failed = [staffResult, shiftResult, reminderResult, timeOffResult, taskResult].find((result) => result.status === "rejected");
        if (failed && !isPasswordChangeRequired(failed.reason.message)) setError(failed.reason.message);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dashboardWeekStart]);

  const activeStaff = staff.filter((person) => person.active).length;
  const isAdmin = currentUser?.role === "admin";
  const weekStart = new Date(`${dashboardWeekStart}T00:00:00`);
  const weekDays = Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(weekStart, index)));
  const weekRange = `${formatDayLabel(weekDays[0])} - ${formatDayLabel(weekDays[6])}`;
  const weekTasks = tasks.filter((task) =>
    task.status !== "done" &&
    task.dueDate &&
    task.dueDate >= weekDays[0] &&
    task.dueDate <= weekDays[6]
  );
  const moveDashboardWeek = (weeks) => {
    setDashboardWeekStart(toDateInputValue(addDays(weekStart, weeks * 7)));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Today"
        title={branding.appTitle}
        description="Weekly rota, cover shifts, tasks, and reminders in one place."
      />

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
          <Metric icon={ListChecks} label="Week tasks" value={weekTasks.length} />
        </div>

        <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-2 lg:grid-cols-6" : "sm:grid-cols-3"}`}>
          {isAdmin && (
            <button onClick={() => goTo("rota-ai")} className={primaryButton}>
              <Bot size={18} />
              Rota AI
            </button>
          )}
          {isAdmin && (
            <button onClick={() => goTo("rota-pattern")} className={primaryButton}>
              <Layers size={18} />
              Rota Pattern
            </button>
          )}
          {isAdmin && (
            <button onClick={() => goTo("add-shift")} className={darkButton}>
              <PlusCircle size={18} />
              One-off Shift
            </button>
          )}
          <button onClick={() => goTo("rota")} className="inline-flex min-h-11 items-center justify-center rounded-md bg-fuel-lime px-4 py-2.5 text-sm font-black text-fuel-ink shadow-sm transition hover:bg-fuel-gold">
            <CalendarDays size={18} className="mr-2" />
            Weekly Rota
          </button>
          <button onClick={() => goTo("tasks")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-mist px-4 py-2.5 text-sm font-black text-fuel-green transition hover:bg-fuel-line">
            <ListChecks size={18} />
            Tasks
          </button>
          {isAdmin && (
            <button onClick={() => goTo("settings")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fuel-mist px-4 py-2.5 text-sm font-black text-fuel-green transition hover:bg-fuel-line">
              <Settings size={18} />
              Settings
            </button>
          )}
          {!isAdmin && (
            <button onClick={() => goTo("reminders")} className={primaryButton}>
              My Reminders
            </button>
          )}
        </div>

        <Card>
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black">Week at a glance</h3>
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fuel-mist text-fuel-green outline-none ring-fuel-green transition hover:bg-fuel-green hover:text-white focus:ring-2"
                    aria-label="Rota calendar information"
                  >
                    <Info size={16} />
                  </button>
                  <span className="pointer-events-none absolute left-1/2 top-9 z-20 hidden w-64 -translate-x-1/2 rounded-md bg-fuel-ink px-3 py-2 text-xs font-bold text-white shadow-lift group-hover:block group-focus-within:block">
                    Dashboard shows a compact summary. Open Weekly Rota for every shift detail.
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
          <DashboardRotaSummary
            activeStaff={staff.filter((person) => person.active)}
            shifts={shifts}
            tasks={weekTasks}
            timeOff={timeOff}
            weekDays={weekDays}
            onOpenWeek={() => goTo("rota")}
          />
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
                <p className="mt-1 text-sm text-slate-700">{displayReminderMessage(reminder, currentUser)}</p>
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

function DashboardRotaSummary({ activeStaff, shifts, tasks, timeOff, weekDays, onOpenWeek }) {
  const visibleShifts = shifts.filter((shift) => !isApprovedOffShift(shift, timeOff, shift.shiftDate));
  const staffOnRota = new Set(visibleShifts.map((shift) => String(shift.staffId))).size;
  const totalHours = visibleShifts.reduce((sum, shift) => sum + Number(shift.paidHours || 0), 0);
  const noteCount = new Set(visibleShifts.map((shift) => shift.notes).filter(Boolean)).size;
  const approvedTimeOffCount = timeOff.filter((request) =>
    request.status === "approved" &&
    request.endDate >= request.startDate &&
    weekDays.some((day) => day >= request.startDate && day <= request.endDate)
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryPill label="Working staff" value={`${staffOnRota}/${activeStaff.length}`} />
        <SummaryPill label="Week shifts" value={visibleShifts.length} />
        <SummaryPill label="Paid hours" value={formatHourTotal(totalHours)} />
        <SummaryPill label="Notes / time off" value={`${noteCount} / ${approvedTimeOffCount}`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {weekDays.map((day) => {
          const dayShifts = visibleShifts.filter((shift) => shift.shiftDate === day);
          const dayTasks = tasks.filter((task) => task.dueDate === day);
          const dayTimeOff = approvedTimeOffForDay(timeOff, day);
          const dayStaff = new Set(dayShifts.map((shift) => String(shift.staffId))).size;
          const dayNotes = new Set(dayShifts.map((shift) => shift.notes).filter(Boolean)).size;
          const previewShifts = dayShifts.slice(0, 3);
          const hiddenShiftCount = Math.max(dayShifts.length - previewShifts.length, 0);

          return (
            <div key={day} className="rounded-md border border-fuel-line bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{formatWeekday(day)}</p>
                  <p className="text-xs font-bold text-slate-500">{formatDayLabel(day)}</p>
                </div>
                <span className="rounded-md bg-fuel-mist px-2 py-1 text-xs font-black text-fuel-green">
                  {dayShifts.length} shifts
                </span>
              </div>

              <div className="min-h-[112px] space-y-2">
                {previewShifts.length > 0 ? previewShifts.map((shift) => (
                  <div key={shift.id} className="rounded-md bg-fuel-mist px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black">{shift.staffName}</p>
                      {shift.isExtra && (
                        <span className="rounded bg-fuel-lime px-1.5 py-0.5 text-[10px] font-black uppercase text-fuel-ink">
                          Extra
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-black text-fuel-green">
                      {formatShiftRange(shift.startTime, shift.endTime)}
                    </p>
                  </div>
                )) : (
                  <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-fuel-line text-sm font-bold text-slate-400">
                    No shifts
                  </div>
                )}

                {hiddenShiftCount > 0 && (
                  <button
                    type="button"
                    className="w-full rounded-md bg-fuel-ink px-2 py-2 text-xs font-black text-white"
                    onClick={onOpenWeek}
                  >
                    +{hiddenShiftCount} more on Weekly Rota
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-md bg-slate-50 px-2 py-1">{dayStaff} staff</span>
                <span className="rounded-md bg-slate-50 px-2 py-1">{dayNotes} notes</span>
                <span className="rounded-md bg-slate-50 px-2 py-1">{dayTasks.length} tasks</span>
                <span className="rounded-md bg-slate-50 px-2 py-1">{dayTimeOff.length} off</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-md border border-fuel-line bg-fuel-mist px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-fuel-ink">{value}</p>
    </div>
  );
}

function formatHourTotal(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function isPasswordChangeRequired(message) {
  return message === "Please change your temporary password before using the rota.";
}

function displayReminderMessage(reminder, currentUser) {
  if (currentUser?.role === "admin") {
    return String(reminder.reminderMessage || "").replace(/^Your shift starts/i, `${reminder.staffName || "Staff"}'s shift starts`);
  }
  return reminder.reminderMessage;
}
