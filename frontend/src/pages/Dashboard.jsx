import React from "react";
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Info, Layers, ListChecks, PlusCircle, Printer, Settings, Sparkles, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";

export function Dashboard({ goTo, currentUser, branding }) {
  const [staff, setStaff] = React.useState([]);
  const [shifts, setShifts] = React.useState([]);
  const [reminders, setReminders] = React.useState([]);
  const [timeOff, setTimeOff] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [availability, setAvailability] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dashboardWeekStart, setDashboardWeekStart] = React.useState(toDateInputValue(getMonday()));
  const [moreOpen, setMoreOpen] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.staff(),
      api.week(dashboardWeekStart),
      api.reminders(),
      api.timeOff(),
      api.tasks(),
      api.availability()
    ])
      .then(([staffResult, shiftResult, reminderResult, timeOffResult, taskResult, availabilityResult]) => {
        if (staffResult.status === "fulfilled") setStaff(staffResult.value);
        if (shiftResult.status === "fulfilled") setShifts(shiftResult.value);
        if (reminderResult.status === "fulfilled") setReminders(reminderResult.value);
        if (timeOffResult.status === "fulfilled") setTimeOff(timeOffResult.value);
        if (taskResult.status === "fulfilled") setTasks(taskResult.value);
        if (availabilityResult.status === "fulfilled") setAvailability(availabilityResult.value);
        const failed = [staffResult, shiftResult, reminderResult, timeOffResult, taskResult, availabilityResult].find((result) => result.status === "rejected");
        if (failed && !isPasswordChangeRequired(failed.reason.message)) setError(failed.reason.message);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dashboardWeekStart]);

  const isAdmin = currentUser?.role === "admin";
  const today = toDateInputValue(new Date());
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
  const attentionItems = getAttentionItems({ shifts, timeOff, tasks, availability, today });
  const workingNow = getWorkingNow(shifts, today);
  const nextShift = getNextShiftToday(shifts, today);
  const tasksDueToday = tasks.filter((task) => task.status !== "done" && task.dueDate === today);

  return (
    <div className="space-y-5">
      <DashboardWelcome branding={branding} currentUser={currentUser} />

      {error && !loading && (
        <p className="rounded-md bg-amber-50 p-3 font-bold text-amber-800">
          Some dashboard data could not load: {error}
        </p>
      )}

      <Status loading={loading} error="">
        <TodayActionPlan
          attentionItems={attentionItems}
          nextShift={nextShift}
          tasksDueToday={tasksDueToday}
          workingNow={workingNow}
        />

        <QuickActions
          goTo={goTo}
          isAdmin={isAdmin}
          moreOpen={moreOpen}
          onToggleMore={() => setMoreOpen((value) => !value)}
        />

        <Card>
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">This Week</h3>
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
              <p className="mt-1 text-sm font-medium text-slate-600">{weekRange}</p>
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
      </Status>
    </div>
  );
}

function DashboardWelcome({ branding, currentUser }) {
  const greeting = getGreeting();
  const name = currentUser?.staffName || currentUser?.username || "admin";
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fuel-green">
            {greeting}, {name}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-fuel-ink sm:text-3xl">
            {branding.appTitle}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Review today's rota, tasks and reminders.
          </p>
        </div>
        <div className="rounded-lg bg-fuel-mist px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today</p>
          <p className="mt-1 text-base font-bold text-fuel-ink">{today}</p>
        </div>
      </div>
    </Card>
  );
}

function TodayActionPlan({ attentionItems, nextShift, tasksDueToday, workingNow }) {
  const hasAlerts = attentionItems.length > 0;
  const workingLabel = workingNow.length ? `${workingNow.length} staff` : "No one scheduled now";
  const nextShiftLabel = nextShift ? `${nextShift.staffName} at ${formatTimeLabel(nextShift.startTime)}` : "No more shifts today";

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-black text-fuel-ink">Today's Action Plan</h2>
        <p className="text-sm font-medium text-slate-600">The four checks that matter most before the day gets busy.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionMiniCard
          icon={Users}
          title="Working now"
          value={workingLabel}
          detail={workingNow[0] ? `${workingNow[0].staffName} ${formatShiftRange(workingNow[0].startTime, workingNow[0].endTime)}` : "No one is currently clocked/scheduled in."}
        />
        <ActionMiniCard
          icon={Clock}
          title="Next shift"
          value={nextShiftLabel}
          detail={nextShift ? formatShiftRange(nextShift.startTime, nextShift.endTime) : "All remaining staff are off."}
        />
        <ActionMiniCard
          icon={ListChecks}
          title="Tasks due today"
          value={tasksDueToday.length}
          detail={tasksDueToday.length ? "Open Tasks to review today's work." : "No tasks due today."}
        />
        <ActionMiniCard
          icon={hasAlerts ? AlertTriangle : CheckCircle2}
          title="Needs attention"
          value={hasAlerts ? `${attentionItems.length} warning${attentionItems.length === 1 ? "" : "s"}` : "All good today"}
          detail={hasAlerts ? attentionItems[0] : "All good today."}
          tone={hasAlerts ? "warning" : "good"}
        />
      </div>
      {hasAlerts && <NeedsAttentionCard items={attentionItems} />}
    </section>
  );
}

function ActionMiniCard({ detail, icon: Icon, title, tone = "default", value }) {
  const toneClass = tone === "warning" ? "bg-amber-50 text-amber-700" : tone === "good" ? "bg-emerald-50 text-fuel-green" : "bg-fuel-mist text-fuel-green";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="mt-1 text-lg font-black text-fuel-ink">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function NeedsAttentionCard({ items }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-fuel-ink">Needs Attention</h3>
          <p className="text-sm font-medium text-slate-600">Admin alerts for rota quality.</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-bold ${items.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-fuel-green"}`}>
          {items.length ? `${items.length} alerts` : "All good"}
        </span>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={item} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-emerald-50 px-3 py-4 text-sm font-bold text-fuel-green">All good today.</p>
      )}
    </Card>
  );
}

function QuickActions({ goTo, isAdmin, moreOpen, onToggleMore }) {
  const moreActions = [
    { label: "Rota AI", page: "rota-ai", icon: Bot },
    { label: "Rota Pattern", page: "rota-pattern", icon: Layers },
    { label: "One-off Shift", page: "add-shift", icon: PlusCircle },
    { label: "Weekly Rota", page: "rota", icon: CalendarDays },
    { label: "Tasks", page: "tasks", icon: ListChecks },
    { label: "Settings", page: "settings", icon: Settings },
    { label: "Print / PDF", page: "rota", icon: Printer }
  ];

  return (
    <div className="relative">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-fuel-green px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-emerald-800"
          onClick={() => goTo(isAdmin ? "add-shift" : "my-shifts")}
        >
          <PlusCircle size={19} />
          {isAdmin ? "Add Shift" : "My Shifts"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-fuel-ink px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-900"
          onClick={() => goTo(isAdmin ? "rota-pattern" : "time-off")}
        >
          <Sparkles size={19} />
          {isAdmin ? "Generate Rota" : "Request Time Off"}
        </button>
        {isAdmin && (
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-fuel-mist px-4 py-3 text-base font-black text-fuel-ink transition hover:bg-emerald-100"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
          >
            More Actions
            <ChevronDown size={18} />
          </button>
        )}
      </div>
      {isAdmin && moreOpen && (
        <div className="absolute right-0 z-30 mt-2 grid w-full gap-1 rounded-lg border border-fuel-line bg-white p-2 shadow-lift sm:w-72">
          {moreActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-bold text-fuel-ink transition hover:bg-fuel-mist"
                onClick={() => goTo(action.page)}
              >
                <Icon size={17} className="text-fuel-green" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
            <div key={day} className="rounded-xl border border-fuel-line/80 bg-fuel-mist/40 p-3 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{formatWeekday(day)}</p>
                  <p className="text-xs font-bold text-slate-500">{formatDayLabel(day)}</p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-fuel-green">
                  {dayShifts.length} shifts
                </span>
              </div>

              <div className="min-h-[112px] space-y-2">
                {previewShifts.length > 0 ? previewShifts.map((shift) => (
                  <div key={shift.id} className="rounded-lg bg-white px-2 py-2 shadow-sm">
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
                <span className="rounded-md bg-white px-2 py-1">{dayStaff} staff</span>
                <span className="rounded-md bg-white px-2 py-1">{dayNotes} notes</span>
                <span className="rounded-md bg-white px-2 py-1">{dayTasks.length} tasks</span>
                <span className="rounded-md bg-white px-2 py-1">{dayTimeOff.length} off</span>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-fuel-ink">{value}</p>
    </div>
  );
}

function getAttentionItems({ shifts, timeOff, tasks, availability, today }) {
  const items = [];
  const pendingTimeOff = timeOff.filter((request) => request.status === "pending").length;
  const longShiftsWithoutBreak = shifts.filter((shift) =>
    !shift.approvedTimeOff &&
    shift.shiftDate >= today &&
    Number(shift.paidHours || shift.totalHours || 0) > 6 &&
    Number(shift.breakMinutes || 0) === 0
  ).length;
  const missedTasks = tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today).length;
  const availabilityConflicts = getAvailabilityConflicts(shifts, availability, today).length;

  if (pendingTimeOff) items.push(`${pendingTimeOff} pending time-off request${pendingTimeOff === 1 ? "" : "s"}.`);
  if (availabilityConflicts) items.push(`${availabilityConflicts} rota conflict${availabilityConflicts === 1 ? "" : "s"} with staff availability.`);
  if (longShiftsWithoutBreak) items.push(`${longShiftsWithoutBreak} shift${longShiftsWithoutBreak === 1 ? "" : "s"} over 6 hours without a break.`);
  if (missedTasks) items.push(`${missedTasks} missed task${missedTasks === 1 ? "" : "s"} need review.`);

  return items;
}

function getAvailabilityConflicts(shifts, availability, today) {
  return shifts.filter((shift) => {
    if (shift.approvedTimeOff || shift.shiftDate < today) return false;
    const shiftDay = new Date(`${shift.shiftDate}T00:00:00`).getDay();
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);

    return availability.some((slot) => {
      const slotWeekday = Number(slot.weekday);
      if (!sameStaff(slot.staffId, shift.staffId) || slotWeekday !== shiftDay) return false;
      return rangesOverlap(shiftStart, shiftEnd, timeToMinutes(slot.startTime), timeToMinutes(slot.endTime));
    });
  });
}

function getWorkingNow(shifts, today, now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return shifts
    .filter((shift) =>
      shift.shiftDate === today &&
      !shift.approvedTimeOff &&
      isTimeInShift(currentMinutes, shift.startTime, shift.endTime)
    )
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
}

function getNextShiftToday(shifts, today, now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return shifts
    .filter((shift) =>
      shift.shiftDate === today &&
      !shift.approvedTimeOff &&
      timeToMinutes(shift.startTime) > currentMinutes
    )
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime))[0];
}

function isTimeInShift(currentMinutes, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return currentMinutes >= start || currentMinutes < end;
  return currentMinutes >= start && currentMinutes < end;
}

function rangesOverlap(startA, endA, startB, endB) {
  if (endA <= startA) endA += 24 * 60;
  if (endB <= startB) endB += 24 * 60;
  return Math.max(startA, startB) < Math.min(endA, endB);
}

function timeToMinutes(value) {
  const [hours = 0, minutes = 0] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTimeLabel(value) {
  const [hours = "00", minutes = "00"] = String(value || "00:00").split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(date).toLowerCase();
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

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
