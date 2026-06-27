import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Home, PlusCircle, Users, Bell, LogOut } from "lucide-react";
import "./index.css";
import { api, setAuthToken } from "./api.js";
import { AddShift } from "./pages/AddShift.jsx";
import { AddStaff } from "./pages/AddStaff.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Login } from "./pages/Login.jsx";
import { Reminders } from "./pages/Reminders.jsx";
import { StaffList } from "./pages/StaffList.jsx";
import { WeeklyRota } from "./pages/WeeklyRota.jsx";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, roles: ["admin", "staff"] },
  { id: "staff", label: "Staff", icon: Users, roles: ["admin"] },
  { id: "add-staff", label: "Add Staff", icon: PlusCircle, roles: ["admin"] },
  { id: "rota", label: "Rota", icon: CalendarDays, roles: ["admin", "staff"] },
  { id: "add-shift", label: "Add Shift", icon: PlusCircle, roles: ["admin"] },
  { id: "reminders", label: "Reminders", icon: Bell, roles: ["admin", "staff"] }
];

function App() {
  const [page, setPage] = React.useState("dashboard");
  const [currentUser, setCurrentUser] = React.useState(null);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const isAdmin = currentUser?.role === "admin";
  const visibleNav = navItems.filter((item) => item.roles.includes(currentUser?.role));
  const pageProps = { goTo: setPage, currentUser };

  React.useEffect(() => {
    api.me()
      .then((result) => setCurrentUser(result.user))
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
          Loading FuelOps Rota...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-fuel-cream">
      <header className="sticky top-0 z-20 border-b border-fuel-line bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button className="flex items-center gap-3 text-left" onClick={() => setPage("dashboard")}>
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-fuel-deep text-lg font-black text-fuel-lime">
              F
            </span>
            <span>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-fuel-green">FuelOps</p>
              <h1 className="text-2xl font-black leading-none text-fuel-ink">Rota</h1>
            </span>
          </button>
          <button
            onClick={() => setPage("add-shift")}
            className={`rounded-md bg-fuel-green px-5 py-3 text-sm font-black text-white shadow-lift transition hover:bg-fuel-deep ${isAdmin ? "" : "hidden"}`}
          >
            Add Shift
          </button>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black uppercase text-fuel-green">{currentUser.role}</p>
              <p className="text-sm font-bold text-slate-600">{currentUser.staffName || currentUser.username}</p>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="rounded-md bg-fuel-mist p-3 text-fuel-green transition hover:bg-fuel-line"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5">
        {page === "dashboard" && <Dashboard {...pageProps} />}
        {page === "staff" && isAdmin && <StaffList />}
        {page === "add-staff" && isAdmin && <AddStaff onSaved={() => setPage("staff")} />}
        {page === "rota" && <WeeklyRota currentUser={currentUser} />}
        {page === "add-shift" && isAdmin && <AddShift onSaved={() => setPage("rota")} />}
        {page === "reminders" && <Reminders />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-fuel-line bg-white/95 backdrop-blur-xl">
        <div className={`mx-auto grid max-w-7xl gap-1 px-2 py-2 ${isAdmin ? "grid-cols-6" : "grid-cols-3"}`}>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={item.label}
                className={`flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-[11px] font-black transition ${
                  active ? "bg-fuel-mist text-fuel-green shadow-soft" : "text-slate-500 hover:bg-slate-50"
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
