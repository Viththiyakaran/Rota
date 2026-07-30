import React from "react";
import { Bell, CalendarDays, CheckCircle2, LockKeyhole, Printer, UserRound } from "lucide-react";
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
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:py-12">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift lg:grid-cols-[1fr_0.88fr]">
        <div className="hidden bg-gradient-to-br from-fuel-deep via-fuel-green to-[#0f766e] p-8 text-white lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/12 text-xl font-black text-fuel-lime ring-1 ring-white/20">L</span>
            <div>
              <h1 className="text-2xl font-black">LocalPlanner</h1>
              <p className="text-sm font-semibold text-emerald-50">Rota, tasks, reminders and reports</p>
            </div>
          </div>
          <div className="mt-12">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-fuel-lime">Small business operations</p>
            <h2 className="mt-3 text-4xl font-black leading-tight">Plan rotas, tasks, time off and reminders in one tidy place.</h2>
          </div>
          <div className="mt-10 grid gap-3">
            <LoginBenefit icon={CalendarDays} text="Create weekly rotas quickly" />
            <LoginBenefit icon={CheckCircle2} text="Track staff time off" />
            <LoginBenefit icon={Bell} text="Send rota reminders" />
            <LoginBenefit icon={Printer} text="Review reports and share weekly plans" />
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fuel-deep text-xl font-black text-fuel-lime shadow-sm">L</span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black leading-none text-fuel-ink">LocalPlanner</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">Rota, tasks, reminders and reports</p>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fuel-deep text-xl font-black text-fuel-lime shadow-sm">
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-xl object-contain p-1" />
              ) : (
                String(branding.businessName || "R").trim().charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black leading-none text-fuel-ink">{branding.businessName || "Your Business"}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">Rota, tasks and staff planning</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
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

function LoginBenefit({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3 ring-1 ring-white/15">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/12">
        <Icon size={18} />
      </span>
      <span className="text-sm font-bold">{text}</span>
    </div>
  );
}
