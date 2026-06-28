import React from "react";
import { KeyRound } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";

export function Account({ currentUser, forced = false, onPasswordChanged = () => {} }) {
  const [form, setForm] = React.useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    try {
      const result = await api.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password changed.");
      if (result.user) onPasswordChanged(result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-fuel-green">{currentUser.role}</p>
        <h2 className="text-3xl font-black">My Account</h2>
        {forced && <p className="mt-2 font-bold text-red-700">Please change your temporary password before using the rota.</p>}
      </div>
      <Card>
        <form className="space-y-4" onSubmit={submit}>
          {message && <p className="rounded-md bg-fuel-mist p-3 font-bold text-fuel-green">{message}</p>}
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p>}
          <Field label="Current password">
            <input className={inputClass} type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password">
            <input className={inputClass} type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <input className={inputClass} type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </Field>
          <button className="flex w-full items-center justify-center gap-2 rounded-md bg-fuel-green px-5 py-4 font-black text-white">
            <KeyRound size={18} />
            Change Password
          </button>
        </form>
      </Card>
    </div>
  );
}
