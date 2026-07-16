import React from "react";
import { createRoot } from "react-dom/client";
import { Bell, Bot, CalendarDays, Clock, Home, Layers, ListChecks, LogOut, Menu, PlusCircle, Settings as SettingsIcon, UserRound, Users, X } from "lucide-react";
import "./index.css";
import { api, setAuthToken } from "./api.js";
import { buildClockPayload, findClockPromptShift, formatClockTime, shouldPromptClockOut } from "./attendanceClock.js";
import { AddShift } from "./pages/AddShift.jsx";
import { AddStaff } from "./pages/AddStaff.jsx";
import { Account } from "./pages/Account.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Login } from "./pages/Login.jsx";
import { MyShifts } from "./pages/MyShifts.jsx";
import { Reminders } from "./pages/Reminders.jsx";
import { RotaAi } from "./pages/RotaAi.jsx";
import { RotaPattern } from "./pages/RotaPattern.jsx";
import { Settings } from "./pages/Settings.jsx";
import { StaffList } from "./pages/StaffList.jsx";
import { Tasks } from "./pages/Tasks.jsx";
import { TimeOff } from "./pages/TimeOff.jsx";
import { WeeklyRota } from "./pages/WeeklyRota.jsx";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, roles: ["admin", "staff"] },
  { id: "my-shifts", label: "My Shifts", icon: Clock, roles: ["staff"] },
  { id: "staff", label: "Staff", icon: Users, roles: ["admin"] },
  { id: "add-staff", label: "Add Staff", icon: PlusCircle, roles: ["admin"], hidden: true },
  { id: "rota", label: "Rota", icon: CalendarDays, roles: ["admin", "staff"] },
  { id: "rota-ai", label: "Rota AI", icon: Bot, roles: ["admin"], hidden: true },
  { id: "rota-pattern", label: "Pattern", icon: Layers, roles: ["admin"], hidden: true },
  { id: "add-shift", label: "Add Shift", icon: PlusCircle, roles: ["admin"], hidden: true },
  { id: "tasks", label: "Tasks", icon: ListChecks, roles: ["admin", "staff"] },
  { id: "time-off", label: "Time Off", icon: Clock, roles: ["admin", "staff"] },
  { id: "reminders", label: "Reminders", icon: Bell, roles: ["admin", "staff"], hidden: true },
  { id: "account", label: "Account", icon: UserRound, roles: ["admin", "staff"] },
  { id: "settings", label: "Settings", icon: SettingsIcon, roles: ["admin"], hidden: true }
];

function App() {
  const [page, setPage] = React.useState("dashboard");
  const [currentUser, setCurrentUser] = React.useState(null);
  const [branding, setBranding] = React.useState({ businessName: "Your Business", logoDataUrl: "" });
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [popupNotification, setPopupNotification] = React.useState(null);
  const [clockPrompt, setClockPrompt] = React.useState(null);
  const [dismissedClockPrompt, setDismissedClockPrompt] = React.useState(null);
  const isAdmin = currentUser?.role === "admin";
  const visibleNav = navItems.filter((item) => item.roles.includes(currentUser?.role) && !item.hidden);
  const desktopNav = navItems.filter((item) =>
    item.roles.includes(currentUser?.role) &&
    ["dashboard", "my-shifts", "staff", "rota", "time-off", "tasks", "reminders", "settings"].includes(item.id)
  );
  const appTitle = buildRotaTitle(branding.businessName);
  const pageProps = { goTo: setPage, currentUser, branding: { ...branding, appTitle } };

  React.useEffect(() => {
    Promise.allSettled([api.branding(), api.me()])
      .then(([brandingResult, meResult]) => {
        if (brandingResult.status === "fulfilled") setBranding(brandingResult.value);
        if (meResult.status === "fulfilled") {
          setCurrentUser(meResult.value.user);
        } else {
          setAuthToken("");
          setCurrentUser(null);
        }
      })
      .catch(() => {
        setAuthToken("");
        setCurrentUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;
    const allowed = navItems.find((item) => item.id === page)?.roles.includes(currentUser.role);
    if (!allowed) setPage("dashboard");
  }, [currentUser, page]);

  React.useEffect(() => {
    const handlePasswordChangeRequired = () => {
      setCurrentUser((user) => user ? { ...user, mustChangePassword: true } : user);
      setPage("account");
      setPopupNotification(null);
    };

    window.addEventListener("fuelops:password-change-required", handlePasswordChangeRequired);
    return () => window.removeEventListener("fuelops:password-change-required", handlePasswordChangeRequired);
  }, []);

  React.useEffect(() => {
    document.title = appTitle;
  }, [appTitle]);

  React.useEffect(() => {
    if (!currentUser) {
      setPopupNotification(null);
      return undefined;
    }

    const dismissedKey = `fuelopsDismissedNotifications:${currentUser.id}`;
    const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || "[]"));

    const checkNotifications = () => {
      api.notifications()
        .then((rows) => {
          const staffShiftReminderTypes = new Set(["shift_reminder", "shift_start"]);
          const popupRows = currentUser.role === "admin"
            ? rows.filter((notification) => !staffShiftReminderTypes.has(notification.type))
            : rows;
          const latestUnread = popupRows.find((notification) => notification.unread && !dismissed.has(String(notification.id)));
          if (latestUnread) setPopupNotification(latestUnread);
        })
        .catch(() => {});
    };

    checkNotifications();
    const timer = window.setInterval(checkNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  React.useEffect(() => {
    if (!currentUser?.staffId || currentUser.mustChangePassword) {
      setClockPrompt(null);
      return undefined;
    }

    let cancelled = false;

    const checkClockPrompt = () => {
      Promise.allSettled([api.myShifts(), api.attendanceStatus()])
        .then(([shiftResult, attendanceResult]) => {
          if (cancelled || shiftResult.status !== "fulfilled" || attendanceResult.status !== "fulfilled") return;
          const shifts = shiftResult.value || [];
          const attendance = attendanceResult.value || {};
          if (!attendance.enabled) {
            setClockPrompt(null);
            return;
          }

          const openEntry = attendance.openEntry;
          if (openEntry && shouldPromptClockOut(openEntry)) {
            const promptKey = `out:${openEntry.id}:${openEntry.clockInAt}`;
            if (dismissedClockPrompt !== promptKey) {
              setClockPrompt({ mode: "out", promptKey, attendance, shifts, shift: openEntry, saving: false, message: "", error: "" });
            }
            return;
          }

          if (!openEntry) {
            const shift = findClockPromptShift(shifts);
            if (shift) {
              const promptKey = `in:${shift.id}:${shift.shiftDate}:${shift.startTime}`;
              if (dismissedClockPrompt !== promptKey) {
                setClockPrompt({ mode: "in", promptKey, attendance, shifts, shift, saving: false, message: "", error: "" });
              }
              return;
            }
          }

          setClockPrompt(null);
        })
        .catch(() => {});
    };

    checkClockPrompt();
    const timer = window.setInterval(checkClockPrompt, 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUser, dismissedClockPrompt]);

  const dismissPopupNotification = () => {
    if (!currentUser || !popupNotification) return;
    const dismissedKey = `fuelopsDismissedNotifications:${currentUser.id}`;
    const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || "[]"));
    dismissed.add(String(popupNotification.id));
    localStorage.setItem(dismissedKey, JSON.stringify([...dismissed].slice(-80)));
    setPopupNotification(null);
  };

  const dismissClockPrompt = () => {
    if (clockPrompt?.promptKey) setDismissedClockPrompt(clockPrompt.promptKey);
    setClockPrompt(null);
  };

  const handleClockPromptAction = async () => {
    if (!clockPrompt) return;
    setClockPrompt((current) => current ? { ...current, saving: true, error: "", message: "" } : current);
    try {
      const payload = await buildClockPayload(clockPrompt.attendance?.locationRequired, clockPrompt.shifts || []);
      const saved = clockPrompt.mode === "in" ? await api.clockIn(payload) : await api.clockOut(payload);
      const message = clockPrompt.mode === "in"
        ? `Clocked in at ${formatClockTime(saved.clockInAt)}.`
        : `Clocked out at ${formatClockTime(saved.clockOutAt)}.`;
      setClockPrompt((current) => current ? { ...current, saving: false, message } : current);
      window.setTimeout(() => {
        setClockPrompt(null);
        setDismissedClockPrompt(null);
      }, 1800);
    } catch (error) {
      setClockPrompt((current) => current ? { ...current, saving: false, error: error.message } : current);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setAuthToken("");
    setCurrentUser(null);
    setPage("dashboard");
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fuel-cream px-4">
        <div className="rounded-md border border-fuel-line bg-white px-5 py-4 font-black text-fuel-green shadow-soft">
          Loading rota...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login branding={{ ...branding, appTitle }} onLogin={setCurrentUser} />;
  }

  if (currentUser.mustChangePassword) {
    return (
      <div className="min-h-screen bg-fuel-cream">
        <header className="border-b border-fuel-line bg-white/95 shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <button className="flex min-w-0 items-center gap-3 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-deep text-lg font-black text-fuel-lime shadow-sm">
                {branding.logoDataUrl ? (
                  <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-lg object-contain p-1" />
                ) : (
                  getBrandInitial(branding.businessName)
                )}
              </span>
              <h1 className="max-w-[180px] truncate text-xl font-black leading-none text-fuel-ink sm:max-w-sm">{appTitle}</h1>
            </button>
            <button
              onClick={logout}
              title="Log out"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green transition hover:bg-fuel-line"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 py-6">
          <Account currentUser={currentUser} forced onPasswordChanged={setCurrentUser} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7faf9]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-fuel-deep via-fuel-green to-[#064e3b] px-3 py-4 text-white shadow-lift lg:flex">
        <button className="mb-6 flex items-center gap-3 rounded-xl px-2 py-2 text-left" onClick={() => setPage("dashboard")}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 text-lg font-black text-fuel-lime ring-1 ring-white/15">
            {branding.logoDataUrl ? (
              <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-xl object-contain p-1.5" />
            ) : (
              getBrandInitial(branding.businessName)
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black">{appTitle}</span>
            <span className="text-xs font-semibold text-emerald-100">LocalOps Planner</span>
          </span>
        </button>

        <nav className="space-y-1">
          {desktopNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                  active ? "bg-white/16 text-white shadow-sm" : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-white/10 bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fuel-green text-sm font-black ring-1 ring-white/20">
              {String(currentUser.staffName || currentUser.username || "A").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{currentUser.staffName || currentUser.username}</p>
              <p className="text-xs font-semibold capitalize text-emerald-100">{currentUser.role}</p>
            </div>
            <button onClick={logout} title="Log out" className="rounded-lg p-2 text-emerald-50 hover:bg-white/10">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-fuel-line bg-white/95 shadow-sm backdrop-blur-xl lg:ml-64">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green lg:hidden">
              <Menu size={20} />
            </button>
            <button className="flex min-w-0 items-center gap-3 text-left lg:hidden" onClick={() => setPage("dashboard")}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-deep text-lg font-black text-fuel-lime shadow-sm">
                {branding.logoDataUrl ? (
                  <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-lg object-contain p-1" />
                ) : (
                  getBrandInitial(branding.businessName)
                )}
              </span>
              <span>
                <h1 className="max-w-[150px] truncate text-lg font-black leading-none text-fuel-ink sm:max-w-sm">{appTitle}</h1>
              </span>
            </button>
            <div className="hidden lg:block">
              <p className="text-sm font-black text-fuel-ink">{branding.businessName || "Your Business"}</p>
              <p className="text-xs font-semibold text-slate-500">Rota, tasks and staff planning</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setPage("rota-ai")}
                className="hidden min-h-10 items-center justify-center gap-2 rounded-lg bg-fuel-green px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-fuel-deep sm:inline-flex"
              >
                <Bot size={18} />
                Rota AI
              </button>
            )}
            <button
              type="button"
              onClick={() => setPage("reminders")}
              title="Reminders"
              className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition ${
                page === "reminders" ? "bg-fuel-green text-white shadow-sm" : "bg-fuel-mist text-fuel-green hover:bg-fuel-line"
              }`}
            >
              <Bell size={20} />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setPage("settings")}
                title="Settings"
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                  page === "settings" ? "bg-fuel-green text-white shadow-sm" : "bg-fuel-mist text-fuel-green hover:bg-fuel-line"
                }`}
              >
                <SettingsIcon size={20} />
              </button>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black uppercase text-fuel-green">{currentUser.role}</p>
              <p className="text-sm font-bold text-slate-600">{currentUser.staffName || currentUser.username}</p>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green transition hover:bg-fuel-line"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 pb-28 pt-4 sm:pt-5 lg:ml-64 lg:pb-8">
        {page === "dashboard" && <Dashboard {...pageProps} />}
        {page === "my-shifts" && <MyShifts branding={{ ...branding, appTitle }} />}
        {page === "staff" && isAdmin && <StaffList goTo={setPage} />}
        {page === "add-staff" && isAdmin && <AddStaff onSaved={() => setPage("staff")} />}
        {page === "rota" && <WeeklyRota currentUser={currentUser} goTo={setPage} />}
        {page === "rota-ai" && isAdmin && <RotaAi goTo={setPage} />}
        {page === "rota-pattern" && isAdmin && <RotaPattern goTo={setPage} />}
        {page === "add-shift" && isAdmin && <AddShift onSaved={() => setPage("rota")} />}
        {page === "tasks" && <Tasks currentUser={currentUser} />}
        {page === "time-off" && <TimeOff currentUser={currentUser} />}
        {page === "reminders" && <Reminders branding={{ ...branding, appTitle }} currentUser={currentUser} />}
        {page === "account" && <Account currentUser={currentUser} onPasswordChanged={setCurrentUser} />}
        {page === "settings" && isAdmin && <Settings branding={branding} onBrandingSaved={setBranding} />}
      </main>

      {popupNotification && (
        <div className="fixed bottom-24 right-3 z-40 w-[calc(100vw-1.5rem)] max-w-xs rounded-xl border border-fuel-line bg-white p-3 text-fuel-ink shadow-lift sm:bottom-6 sm:right-6">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuel-lime">
              <Bell size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-fuel-green">New notification</p>
              <p className="mt-1 truncate text-base font-black">{popupNotification.title}</p>
              <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-700">{popupNotification.message}</p>
              <button
                className="mt-3 rounded-md bg-fuel-green px-3 py-2 text-sm font-black text-white"
                onClick={() => {
                  setPage("reminders");
                  dismissPopupNotification();
                }}
              >
                View
              </button>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-fuel-mist text-fuel-green hover:bg-fuel-line"
              onClick={dismissPopupNotification}
              title="Close notification"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {clockPrompt && (
        <ClockPrompt
          prompt={clockPrompt}
          onAction={handleClockPromptAction}
          onClose={dismissClockPrompt}
          onOpenShifts={() => setPage("my-shifts")}
        />
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-fuel-line bg-white/90 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-2 sm:gap-2">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={item.label}
                className={`flex min-h-14 min-w-20 flex-1 flex-col items-center justify-center rounded-lg px-2 py-2 text-[11px] font-black normal-case transition sm:min-w-24 ${
                  active ? "bg-fuel-green text-white shadow-sm" : "bg-transparent text-slate-500 shadow-none hover:bg-fuel-mist hover:text-fuel-green"
                }`}
              >
                <Icon size={20} />
                <span className="mt-1 truncate">{item.label.replace("Add ", "+ ")}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function ClockPrompt({ prompt, onAction, onClose, onOpenShifts }) {
  const isClockOut = prompt.mode === "out";
  const shift = prompt.shift || {};
  const title = isClockOut ? "Time to clock out" : "Time to clock in";
  const body = isClockOut
    ? `Your ${shift.startTime || ""}-${shift.endTime || ""} shift has finished.`
    : `Your shift starts at ${shift.startTime || ""}.`;

  return (
    <div className="fixed bottom-24 left-3 z-40 w-[calc(100vw-1.5rem)] max-w-sm rounded-xl border border-fuel-line bg-white p-4 text-fuel-ink shadow-lift sm:bottom-6 sm:left-6">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-lime">
          <Clock size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-fuel-green">Clock In / Out</p>
          <p className="mt-1 text-lg font-black">{title}</p>
          <p className="mt-1 text-sm font-bold text-slate-700">{body}</p>
          {shift.notes && <p className="mt-2 rounded-md bg-fuel-mist px-2 py-1 text-xs font-bold text-slate-700">{shift.notes}</p>}
          {prompt.attendance?.locationRequired && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
              Location permission is required when you tap {isClockOut ? "Clock Out" : "Clock In"}.
            </p>
          )}
          {prompt.message && <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-fuel-green">{prompt.message}</p>}
          {prompt.error && <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{prompt.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-fuel-green px-3 py-2 text-sm font-black text-white disabled:bg-slate-300"
              disabled={prompt.saving}
              onClick={onAction}
            >
              {prompt.saving ? "Saving..." : isClockOut ? "Clock Out" : "Clock In"}
            </button>
            <button
              type="button"
              className="rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green"
              onClick={onOpenShifts}
            >
              My Shifts
            </button>
          </div>
        </div>
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-fuel-mist text-fuel-green hover:bg-fuel-line"
          onClick={onClose}
          title="Close clock reminder"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function buildRotaTitle(businessName) {
  const name = String(businessName || "Your Business").trim();
  return /\brota\b/i.test(name) ? name : `${name} Rota`;
}

function getBrandInitial(businessName) {
  return String(businessName || "R").trim().charAt(0).toUpperCase();
}
