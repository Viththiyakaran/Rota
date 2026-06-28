import React from "react";
import { createRoot } from "react-dom/client";
import { Button, IconButton, ThemeProvider, Typography } from "@material-tailwind/react";
import { Bell, CalendarDays, Clock, Home, LogOut, PlusCircle, Settings as SettingsIcon, UserRound, Users } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-fuel-cream">
      <header className="sticky top-0 z-20 border-b border-fuel-line bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[1fr_auto_1fr]">
          <button className="flex items-center gap-3 text-left" onClick={() => setPage("dashboard")}>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fuel-deep text-lg font-black text-fuel-lime shadow-md">
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-xl object-contain p-1" />
              ) : (
                getBrandInitial(branding.businessName)
              )}
            </span>
            <span>
              <Typography as="h1" variant="h4" className="max-w-[180px] truncate font-black leading-none text-fuel-ink sm:max-w-sm">
                {appTitle}
              </Typography>
            </span>
          </button>
          <Button
            size="lg"
            onClick={() => setPage("add-shift")}
            className={`hidden rounded-lg bg-fuel-green px-5 py-3 text-sm font-black normal-case text-white shadow-md transition hover:bg-fuel-deep lg:block ${isAdmin ? "" : "lg:hidden"}`}
          >
            Add Shift
          </Button>
          <div className="flex items-center justify-end gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black uppercase text-fuel-green">{currentUser.role}</p>
              <p className="text-sm font-bold text-slate-600">{currentUser.staffName || currentUser.username}</p>
            </div>
            <IconButton
              variant="filled"
              onClick={logout}
              title="Log out"
              className="rounded-lg bg-fuel-mist text-fuel-green shadow-none transition hover:bg-fuel-line"
            >
              <LogOut size={20} />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5">
        {page === "dashboard" && <Dashboard {...pageProps} />}
        {page === "my-shifts" && <MyShifts />}
        {page === "staff" && isAdmin && <StaffList goTo={setPage} />}
        {page === "add-staff" && isAdmin && <AddStaff onSaved={() => setPage("staff")} />}
        {page === "rota" && <WeeklyRota currentUser={currentUser} />}
        {page === "add-shift" && isAdmin && <AddShift onSaved={() => setPage("rota")} />}
        {page === "time-off" && <TimeOff currentUser={currentUser} />}
        {page === "reminders" && <Reminders />}
        {page === "account" && <Account currentUser={currentUser} />}
        {page === "settings" && isAdmin && <Settings branding={branding} onBrandingSaved={setBranding} />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-fuel-line bg-white/90 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-2 py-2">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <Button
                key={item.id}
                variant={active ? "filled" : "text"}
                onClick={() => setPage(item.id)}
                title={item.label}
                className={`flex min-h-14 min-w-20 flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-black normal-case transition sm:min-w-24 ${
                  active ? "bg-fuel-green text-white shadow-md" : "bg-transparent text-slate-500 shadow-none hover:bg-fuel-mist hover:text-fuel-green"
                }`}
              >
                <Icon size={20} />
                <span className="mt-1 truncate">{item.label.replace("Add ", "+ ")}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

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
