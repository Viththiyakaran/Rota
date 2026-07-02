import React from "react";
import { PlusCircle } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, primaryButton, softButton, darkButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";

export function StaffList({ goTo }) {
  const [staff, setStaff] = React.useState([]);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = () => {
    setLoading(true);
    api.staff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  React.useEffect(load, []);

  const startEdit = (person) => {
    setEditingId(person.id);
    setForm(person);
  };

  const save = async () => {
    await api.updateStaff(editingId, form);
    setEditingId(null);
    load();
  };

  const deactivate = async (person) => {
    await api.updateStaff(person.id, { active: false });
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Team"
        title="Staff"
        description="View staff details, update roles, and deactivate people who no longer need rota access."
        action={(
          <button type="button" className={primaryButton} onClick={() => goTo("add-staff")}>
            <PlusCircle size={18} />
            Add Staff
          </button>
        )}
      />
      <Status loading={loading} error={error} empty={staff.length === 0}>
        <div className="space-y-3">
          {staff.map((person) => (
            <Card key={person.id}>
              {editingId === person.id ? (
                <div className="space-y-3">
                  <Field label="Name">
                    <input className={inputClass} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Phone">
                    <input className={inputClass} inputMode="tel" placeholder="07123 456789" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input className={inputClass} value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                  <Field label="Role">
                    <input className={inputClass} value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                  </Field>
                  <Field label="Active">
                    <select
                      className={inputClass}
                      value={form.active ? "true" : "false"}
                      onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <button className={primaryButton} onClick={save}>Save</button>
                    <button className={softButton} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black">{person.name}</p>
                      <p className="font-bold text-fuel-green">{person.role}</p>
                      <p className="text-sm text-slate-600">{person.phone}</p>
                      <p className="text-sm text-slate-600">{person.email}</p>
                    </div>
                    <Pill tone={person.active ? "green" : "slate"}>{person.active ? "Active" : "Inactive"}</Pill>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className={darkButton} onClick={() => startEdit(person)}>Edit</button>
                    <button className={softButton} onClick={() => deactivate(person)}>Deactivate</button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Status>
    </div>
  );
}
