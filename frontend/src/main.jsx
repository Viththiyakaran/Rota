import React from "react";
import { createRoot } from "react-dom/client";
import { Bell, CalendarDays, Clock, Home, LogOut, PlusCircle, Settings as SettingsIcon, UserRound, Users, X } from "lucide-react";
import "./index.css";
import { api, setAuthToken } from "./api.js";
import { AddShift } from "./pages/AddShift.jsx";
import { AddStaff } from "./pages/AddStaff.jsx";
import { Account } from "./pages/Account.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Login } from "./pages/Login.jsx";
import { MyShifts } from "./pages/MyShifts.jsx";
import { Reminders } from "./pages/Reminders.jsx";
import { Settings } from "./pages/Settings.jsx";
import { StaffList } from "./pages/StaffList.jsx";
import { TimeOff } from "./pages/TimeOff.jsx";
import { WeeklyRota } from "./pages/WeeklyRota.jsx";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, roles: ["admin", "staff"] },
  { id: "my-shifts", label: "My Shifts", icon: Clock, roles: ["staff"] },
  { id: "staff", label: "Staff", icon: Users, roles: ["admin"] },
  { id: "add-staff", label: "Add Staff", icon: PlusCircle, roles: ["admin"], hidden: true },
  { id: "rota", label: "Rota", icon: CalendarDays, roles: ["admin", "staff"] },
  { id: "add-shift", label: "Add Shift", icon: PlusCircle, roles: ["admin"], hidden: true },
  { id: "time-off", label: "Time Off", icon: Clock, roles: ["admin", "staff"] },
  { id: "reminders", label: "Reminders", icon: Bell, roles: ["admin", "staff"] },
  { id: "account", label: "Account", icon: UserRound, roles: ["admin", "staff"] },
  { id: "settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] }
];

function App() {
  const [page, setPage] = React.useState("dashboard");
  const [currentUser, setCurrentUser] = React.useState(null);
  const [branding, setBranding] = React.useState({ businessName: "Your Business", logoDataUrl: "" });
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [popupNotification, setPopupNotification] = React.useState(null);
  const isAdmin = currentUser?.role === "admin";
  const visibleNav = navItems.filter((item) => item.roles.includes(currentUser?.role) && !item.hidden);
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

  const dismissPopupNotification = () => {
    if (!currentUser || !popupNotification) return;
    const dismissedKey = `fuelopsDismissedNotifications:${currentUser.id}`;
    const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || "[]"));
    dismissed.add(String(popupNotification.id));
    localStorage.setItem(dismissedKey, JSON.stringify([...dismissed].slice(-80)));
    setPopupNotification(null);
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
            <button className="flex items-center gap-3 text-left">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fuel-deep text-lg font-black text-fuel-lime shadow-md">
                {branding.logoDataUrl ? (
                  <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-xl object-contain p-1" />
                ) : (
                  getBrandInitial(branding.businessName)
                )}
              </span>
              <h1 className="max-w-[180px] truncate text-2xl font-black leading-none text-fuel-ink sm:max-w-sm">{appTitle}</h1>
            </button>
            <button
              onClick={logout}
              title="Log out"
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green transition hover:bg-fuel-line"
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
    <div className="min-h-screen bg-fuel-cream">
      <header className="sticky top-0 z-20 border-b border-fuel-line bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <button className="flex items-center gap-3 text-left" onClick={() => setPage("dashboard")}>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fuel-deep text-lg font-black text-fuel-lime shadow-md">
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-xl object-contain p-1" />
              ) : (
                getBrandInitial(branding.businessName)
              )}
            </span>
            <span>
              <h1 className="max-w-[180px] truncate text-2xl font-black leading-none text-fuel-ink sm:max-w-sm">
                {appTitle}
              </h1>
            </span>
          </button>
          <div className="flex items-center justify-end gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black uppercase text-fuel-green">{currentUser.role}</p>
              <p className="text-sm font-bold text-slate-600">{currentUser.staffName || currentUser.username}</p>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green transition hover:bg-fuel-line"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5">
        {page === "dashboard" && <Dashboard {...pageProps} />}
        {page === "my-shifts" && <MyShifts branding={{ ...branding, appTitle }} />}
        {page === "staff" && isAdmin && <StaffList goTo={setPage} />}
        {page === "add-staff" && isAdmin && <AddStaff onSaved={() => setPage("staff")} />}
        {page === "rota" && <WeeklyRota currentUser={currentUser} />}
        {page === "add-shift" && isAdmin && <AddShift onSaved={() => setPage("rota")} />}
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

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-fuel-line bg-white/90 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-2 py-2">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={item.label}
                className={`flex min-h-14 min-w-20 flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-black normal-case transition sm:min-w-24 ${
                  active ? "bg-fuel-green text-white shadow-md" : "bg-transparent text-slate-500 shadow-none hover:bg-fuel-mist hover:text-fuel-green"
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
