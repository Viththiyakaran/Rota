import React from "react";
import { CalendarDays, CheckCircle2, ClipboardCheck, LockKeyhole, PackageCheck, ShoppingCart, TrendingUp, UserRound } from "lucide-react";
import { api, setAuthToken } from "../api.js";
import { Field, inputClass } from "../components/Field.jsx";
import { primaryButton } from "../components/PageHeader.jsx";

export function Login({ branding, onLogin }) {
  const [form, setForm] = React.useState({ username: "", password: "" });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await api.login(form);
      setAuthToken("");
      onLogin(result.user);
    } catch (err) {
      setAuthToken("");
      setError(err.message.includes("fetch") ? "Could not connect to the rota server. Please check the backend URL and CORS settings." : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen min-h-[100dvh] items-center bg-[#f8fafc] sm:px-4 sm:py-10">
      <section className="mx-auto grid min-h-[100dvh] w-full min-w-0 max-w-5xl overflow-hidden bg-white sm:min-h-0 sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-lift lg:grid-cols-[1fr_0.88fr]">
        <div className="login-story-panel hidden p-8 text-white lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-white/20">
              <img src="/localplanner-mark.svg" alt="" className="h-full w-full" />
            </span>
            <div>
              <h1 className="text-2xl font-black">LocalPlanner</h1>
              <p className="text-sm font-semibold text-blue-50">Rota, weekly tasks and performance</p>
            </div>
          </div>
          <div className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Your station, organised</p>
            <h2 className="mt-2 text-3xl font-black leading-tight">One weekly view for the whole station.</h2>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-blue-100">
              Plan shifts, complete stock counts, manage orders and track sales from one simple workspace.
            </p>
          </div>
          <LocalPlannerStory />
        </div>

        <div className="flex min-w-0 flex-col justify-center px-5 py-8 sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
              <img src="/localplanner-mark.svg" alt="" className="h-full w-full" />
            </span>
            <div className="mt-3 min-w-0">
              <h1 className="text-2xl font-black leading-none text-fuel-ink">LocalPlanner</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">Rota, weekly tasks and performance</p>
            </div>
          </div>

          <div className="mb-7 min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center sm:flex sm:items-center sm:gap-3 sm:text-left">
            <span className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-fuel-deep text-xl font-black text-fuel-lime shadow-sm sm:mx-0 sm:h-12 sm:w-12">
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-xl object-contain p-1" />
              ) : (
                String(branding.businessName || "R").trim().charAt(0).toUpperCase()
              )}
            </span>
            <div className="mt-3 min-w-0 sm:mt-0">
              <h2 className="break-words text-lg font-black leading-tight text-fuel-ink sm:text-xl">{branding.businessName || "Your Business"}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Rota, orders and staff planning</p>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-black text-fuel-ink">Sign in</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Use your staff or admin account.</p>
          </div>

          <form className="min-w-0 space-y-4" onSubmit={submit}>
          <Field label="Username">
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                className={`${inputClass} pl-10`}
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                autoComplete="username"
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                className={`${inputClass} pl-10`}
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="current-password"
              />
            </div>
          </Field>

          {error && <p className="rounded-md bg-red-50 px-3 py-3 text-sm font-black text-red-700">{error}</p>}

            <button className={`${primaryButton} w-full disabled:bg-slate-300`} disabled={saving}>
              {saving ? "Signing in..." : "Sign in"}
            </button>
            <p className="text-center text-xs font-semibold text-slate-500">For authorised staff only</p>
          </form>
        </div>
      </section>
    </main>
  );
}

function LocalPlannerStory() {
  const features = [
    { key: "rota", icon: CalendarDays, label: "Weekly rota", title: "Team scheduled", detail: "3 staff · 7 shifts", metric: "Ready", tone: "blue" },
    { key: "gas", icon: PackageCheck, label: "Gas stock", title: "Count due Saturday", detail: "8 products · assigned to Viththi", metric: "Due", tone: "emerald" },
    { key: "orders", icon: ShoppingCart, label: "Supplier orders", title: "Weekly plans active", detail: "Morrisons · Vape · Medicine", metric: "3 plans", tone: "amber" },
    { key: "sales", icon: TrendingUp, label: "Performance", title: "Sales updated", detail: "This week compared with last week", metric: "£6,215", tone: "indigo" }
  ];

  return (
    <div className="login-story mt-6" aria-label="LocalPlanner organises rota, stock, orders and sales">
      <div className="login-story-glow" aria-hidden="true" />
      <div className="login-story-board">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-fuel-green">
              <ClipboardCheck size={17} />
            </span>
            <div>
              <p className="text-xs font-black text-slate-900">Live station overview</p>
              <p className="text-[10px] font-bold text-slate-400">Today and this week</p>
            </div>
          </div>
          <span className="login-story-live">
            <span />
            Live
          </span>
        </div>

        <div className="login-feature-stage">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div className={`login-feature-card login-feature-${feature.tone}`} style={{ "--feature-delay": `${index * 3}s` }} key={feature.key}>
                <div className="flex items-center gap-3">
                  <span className="login-feature-icon"><Icon size={22} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{feature.label}</p>
                    <p className="mt-1 truncate text-base font-black text-slate-900">{feature.title}</p>
                    <p className="mt-1 truncate text-[10px] font-bold text-slate-500">{feature.detail}</p>
                  </div>
                  <span className="login-feature-metric">{feature.metric}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <span className="h-2 rounded-full bg-current opacity-20" />
                  <span className="h-2 rounded-full bg-current opacity-35" />
                  <span className="h-2 rounded-full bg-current opacity-60" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mx-3 mb-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="grid grid-cols-4 gap-2" aria-hidden="true">
            {features.map((feature, index) => (
              <span className="login-feature-progress" style={{ "--feature-delay": `${index * 3}s` }} key={feature.key} />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] font-black uppercase tracking-wide text-slate-400">
            <span>Rota</span><span>Gas</span><span>Orders</span><span>Sales</span>
          </div>
        </div>
      </div>

      <div className="login-story-ready">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <CheckCircle2 size={16} />
        </span>
        <div>
          <p className="text-[11px] font-black">Station under control</p>
          <p className="text-[9px] font-semibold text-blue-100">Everyone sees what is next</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100">
        <span>Plan once</span><span className="h-1 w-1 rounded-full bg-blue-200/70" /><span>Complete weekly</span><span className="h-1 w-1 rounded-full bg-blue-200/70" /><span>Review results</span>
      </div>
    </div>
  );
}
