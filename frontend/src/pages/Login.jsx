import React from "react";
import { LockKeyhole, UserRound } from "lucide-react";
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
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-fuel-cream px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-fuel-line bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-fuel-deep text-xl font-black text-fuel-lime shadow-sm">
            {branding.logoDataUrl ? (
              <img src={branding.logoDataUrl} alt="" className="h-full w-full rounded-lg object-contain p-1" />
            ) : (
              String(branding.businessName || "R").trim().charAt(0).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black leading-none text-fuel-ink">{branding.appTitle}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">Rota Login</p>
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

          <button
            className={`${primaryButton} w-full`}
            disabled={saving}
          >
            {saving ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
