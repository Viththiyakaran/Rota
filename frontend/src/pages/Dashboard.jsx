import React from "react";
import { Bot, CalendarDays, ChevronLeft, ChevronRight, CloudSun, Info, Layers, ListChecks, MapPin, MessageCircle, PlusCircle, RefreshCw, Settings, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { darkButton, primaryButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDayLabel, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";

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
      <DashboardWelcome branding={branding} currentUser={currentUser} />

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

      </Status>
    </div>
  );
}

function DashboardWelcome({ branding, currentUser }) {
  const greeting = getGreeting();
  const name = currentUser?.staffName || currentUser?.username || "there";
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-fuel-green">{greeting}</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-fuel-ink sm:text-4xl">
              {name}, welcome back
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-bold text-slate-600">
              {branding.appTitle} is ready for {today}. Review today, update cover, and keep the team informed.
            </p>
          </div>
          <div className="rounded-lg bg-fuel-mist px-4 py-3 text-left sm:text-right">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Today</p>
            <p className="mt-1 text-lg font-black text-fuel-ink">{today}</p>
          </div>
        </div>
      </Card>
      <WeatherCard />
    </div>
  );
}

function WeatherCard() {
  const [weather, setWeather] = React.useState(null);
  const [status, setStatus] = React.useState("Loading weather...");
  const [loading, setLoading] = React.useState(false);

  const loadWeather = React.useCallback((coords = { latitude: 51.5072, longitude: -0.1276, label: "London" }) => {
    setLoading(true);
    setStatus("Loading weather...");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Weather unavailable");
        return response.json();
      })
      .then((data) => {
        setWeather({
          label: coords.label,
          temperature: Math.round(Number(data.current?.temperature_2m || 0)),
          wind: Math.round(Number(data.current?.wind_speed_10m || 0)),
          condition: weatherCodeLabel(data.current?.weather_code)
        });
        setStatus("");
      })
      .catch(() => {
        setWeather(null);
        setStatus("Weather is unavailable right now.");
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Location is not supported on this browser.");
      return;
    }
    setLoading(true);
    setStatus("Checking your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => loadWeather({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: "Your area"
      }),
      () => {
        setLoading(false);
        setStatus("Location denied. Showing London weather.");
        loadWeather();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  };

  return (
    <Card className="bg-fuel-ink text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-fuel-lime">Current weather</p>
          {weather ? (
            <>
              <p className="mt-2 text-4xl font-black">{weather.temperature}°C</p>
              <p className="mt-1 text-sm font-bold text-white/80">{weather.condition}</p>
              <p className="mt-3 flex items-center gap-1 text-xs font-bold text-white/70">
                <MapPin size={14} />
                {weather.label} · wind {weather.wind} km/h
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm font-bold text-white/75">{status}</p>
          )}
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-fuel-lime">
          <CloudSun size={26} />
        </span>
      </div>
      <button
        type="button"
        className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white/20"
        onClick={useMyLocation}
        disabled={loading}
      >
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        {loading ? "Updating" : "Use my location"}
      </button>
    </Card>
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

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function weatherCodeLabel(code) {
  const value = Number(code);
  if ([0].includes(value)) return "Clear sky";
  if ([1, 2].includes(value)) return "Partly cloudy";
  if ([3].includes(value)) return "Cloudy";
  if ([45, 48].includes(value)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(value)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "Snow";
  if ([95, 96, 99].includes(value)) return "Thunderstorm";
  return "Weather update";
}
