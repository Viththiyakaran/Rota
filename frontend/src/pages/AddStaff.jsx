import React from "react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";

export function AddStaff({ onSaved }) {
  const [form, setForm] = React.useState({ name: "", phone: "", email: "", role: "Cashier", active: true });
  const [error, setError] = React.useState("");

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.createStaff(form);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-black">Add Staff</h2>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p>}
          <Field label="Name">
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option>Manager</option>
              <option>Supervisor</option>
              <option>Cashier</option>
              <option>Fuel Attendant</option>
            </select>
          </Field>
          <button className="w-full rounded-md bg-fuel-green py-4 text-lg font-black text-white">Save Staff</button>
        </form>
      </Card>
    </div>
  );
}
