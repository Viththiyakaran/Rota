import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Home, PlusCircle, Users, Bell } from "lucide-react";
import "./index.css";
import { AddShift } from "./pages/AddShift.jsx";
import { AddStaff } from "./pages/AddStaff.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Reminders } from "./pages/Reminders.jsx";
import { StaffList } from "./pages/StaffList.jsx";
import { WeeklyRota } from "./pages/WeeklyRota.jsx";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "staff", label: "Staff", icon: Users },
  { id: "add-staff", label: "Add Staff", icon: PlusCircle },
  { id: "rota", label: "Rota", icon: CalendarDays },
  { id: "add-shift", label: "Add Shift", icon: PlusCircle },
  { id: "reminders", label: "Reminders", icon: Bell }
];

function App() {
  const [page, setPage] = React.useState("dashboard");
  const pageProps = { goTo: setPage };

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
            className="rounded-md bg-fuel-green px-5 py-3 text-sm font-black text-white shadow-lift transition hover:bg-fuel-deep"
          >
            Add Shift
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5">
        {page === "dashboard" && <Dashboard {...pageProps} />}
        {page === "staff" && <StaffList />}
        {page === "add-staff" && <AddStaff onSaved={() => setPage("staff")} />}
        {page === "rota" && <WeeklyRota />}
        {page === "add-shift" && <AddShift onSaved={() => setPage("rota")} />}
        {page === "reminders" && <Reminders />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-fuel-line bg-white/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-6 gap-1 px-2 py-2">
          {navItems.map((item) => {
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
