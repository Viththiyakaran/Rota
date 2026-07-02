import React from "react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, primaryButton } from "../components/PageHeader.jsx";

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
      <PageHeader
        eyebrow="Team"
        title="Add Staff"
        description="Create a staff record and temporary login. The staff member will change their password at first login."
      />
      <Card>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700 md:col-span-2">{error}</p>}
          <Field label="Name">
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} inputMode="tel" placeholder="07123 456789" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
          <button className={`${primaryButton} md:col-span-2`}>Save Staff</button>
        </form>
      </Card>
    </div>
  );
}
