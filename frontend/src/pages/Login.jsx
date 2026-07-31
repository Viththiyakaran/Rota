import React from "react";
import { Bell, CalendarDays, Check, CheckCircle2, Clock3, LockKeyhole, UserRound, UsersRound } from "lucide-react";
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
              <p className="text-sm font-semibold text-blue-50">Rota, tasks, reminders and reports</p>
            </div>
          </div>
          <div className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Your week, organised</p>
            <h2 className="mt-2 text-3xl font-black leading-tight">From an empty rota to a ready team.</h2>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-blue-100">
              Plan shifts, assign work and keep everyone updated from one simple workspace.
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
              <p className="mt-2 text-sm font-semibold text-slate-500">Rota, tasks, reminders and reports</p>
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
              <p className="mt-1 text-sm font-semibold text-slate-500">Rota, tasks and staff planning</p>
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
  const days = [
    { day: "Mon", name: "Veera", time: "05:30–14:00" },
    { day: "Tue", name: "Viththi", time: "13:00–22:00" },
    { day: "Wed", name: "Afridi", time: "06:00–14:00" },
  ];

  return (
    <div className="login-story mt-6" aria-label="LocalPlanner organises shifts, tasks and reminders">
      <div className="login-story-glow" aria-hidden="true" />
      <div className="login-story-board">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-fuel-green">
              <CalendarDays size={17} />
            </span>
            <div>
              <p className="text-xs font-black text-slate-900">Weekly rota</p>
              <p className="text-[10px] font-bold text-slate-400">Monday – Sunday</p>
            </div>
          </div>
          <span className="login-story-live">
            <span />
            Live
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3">
          {days.map((shift, index) => (
            <div className="login-story-shift" style={{ "--shift-delay": `${index * 0.45}s` }} key={shift.day}>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{shift.day}</p>
              <div className="mt-2 rounded-lg border-l-[3px] border-fuel-green bg-blue-50 px-2 py-2">
                <p className="truncate text-[11px] font-black text-slate-900">{shift.name}</p>
                <p className="mt-0.5 whitespace-nowrap text-[9px] font-bold text-fuel-green">{shift.time}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-3 mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex -space-x-1.5">
            {["V", "V", "A"].map((initial, index) => (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-[9px] font-black text-fuel-green" key={`${initial}-${index}`}>
                {initial}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-600">
            <Clock3 size={13} className="text-fuel-green" />
            3 staff · 7 shifts
          </div>
        </div>
      </div>

      <div className="login-story-event login-story-event-task">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check size={16} strokeWidth={3} />
        </span>
        <div>
          <p className="text-[11px] font-black text-slate-900">Task completed</p>
          <p className="text-[9px] font-bold text-slate-400">Forecourt safety check</p>
        </div>
      </div>

      <div className="login-story-event login-story-event-reminder">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Bell size={15} />
        </span>
        <div>
          <p className="text-[11px] font-black text-slate-900">Team notified</p>
          <p className="text-[9px] font-bold text-slate-400">Rota reminder sent</p>
        </div>
      </div>

      <div className="login-story-ready">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <CheckCircle2 size={16} />
        </span>
        <div>
          <p className="text-[11px] font-black">Week ready</p>
          <p className="text-[9px] font-semibold text-blue-100">Everyone knows what’s next</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100">
        <span className="flex items-center gap-1.5"><UsersRound size={13} /> Assign</span>
        <span className="h-1 w-1 rounded-full bg-blue-200/70" />
        <span className="flex items-center gap-1.5"><Bell size={13} /> Remind</span>
        <span className="h-1 w-1 rounded-full bg-blue-200/70" />
        <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Done</span>
      </div>
    </div>
  );
}
