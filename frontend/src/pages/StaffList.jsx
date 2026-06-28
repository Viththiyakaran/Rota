import React from "react";
import { Button, Chip, Typography } from "@material-tailwind/react";
import { PlusCircle } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Typography as="h2" variant="h3" className="font-black text-fuel-ink">
          Staff List
        </Typography>
        <Button
          type="button"
          size="lg"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-fuel-green px-5 py-3 font-black normal-case text-white shadow-md transition hover:bg-fuel-deep"
          onClick={() => goTo("add-staff")}
        >
          <PlusCircle size={18} />
          Add Staff
        </Button>
      </div>
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
                    <input className={inputClass} value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                    <button className="rounded-md bg-fuel-green py-3 font-black text-white" onClick={save}>Save</button>
                    <button className="rounded-md bg-slate-100 py-3 font-black" onClick={() => setEditingId(null)}>Cancel</button>
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
                    <Chip
                      size="sm"
                      value={person.active ? "Active" : "Inactive"}
                      className={`rounded-full font-black normal-case ${person.active ? "bg-fuel-mist text-fuel-green" : "bg-slate-100 text-slate-500"}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button className="rounded-lg bg-fuel-ink py-3 font-black normal-case text-white shadow-md" onClick={() => startEdit(person)}>Edit</Button>
                    <Button variant="filled" className="rounded-lg bg-slate-100 py-3 font-black normal-case text-fuel-ink shadow-none" onClick={() => deactivate(person)}>Deactivate</Button>
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
