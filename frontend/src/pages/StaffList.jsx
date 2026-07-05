import React from "react";
import { PlusCircle, Search } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, primaryButton, softButton, dangerButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";

export function StaffList({ goTo }) {
  const [staff, setStaff] = React.useState([]);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("active");

  const load = () => {
    setLoading(true);
    api.staff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  React.useEffect(load, []);

  const filteredStaff = staff.filter((person) => {
    const matchesStatus = filter === "all" || (filter === "active" ? person.active : !person.active);
    const text = `${person.name} ${person.role} ${person.phone} ${person.email}`.toLowerCase();
    return matchesStatus && text.includes(query.trim().toLowerCase());
  });

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
        description="Search, update, and manage staff records from one tidy list."
        action={(
          <button type="button" className={primaryButton} onClick={() => goTo("add-staff")}>
            <PlusCircle size={18} />
            Add Staff
          </button>
        )}
      />

      <Card className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className={`${inputClass} pl-10`}
              placeholder="Search staff by name, role, phone, or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-1">
            {["active", "inactive", "all"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-md px-3 py-2 text-sm font-bold capitalize transition ${
                  filter === option ? "bg-white text-fuel-green shadow-sm" : "text-slate-500 hover:text-fuel-green"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {editingId && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold">Edit staff</h3>
              <p className="text-sm text-slate-500">Update contact details, role, or active status.</p>
            </div>
            <button type="button" className={softButton} onClick={() => setEditingId(null)}>Cancel</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <input className={inputClass} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Role">
              <input className={inputClass} value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} inputMode="tel" placeholder="07123 456789" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputClass} type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.active ? "true" : "false"} onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
            <div className="flex items-end">
              <button className={`${primaryButton} w-full`} onClick={save}>Save changes</button>
            </div>
          </div>
        </Card>
      )}

      <Status loading={loading} error={error} empty={filteredStaff.length === 0}>
        <Card className="hidden overflow-hidden p-0 lg:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold">Role</th>
                <th className="px-4 py-3 font-bold">Phone</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fuel-line">
              {filteredStaff.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-extrabold text-fuel-ink">{person.name}</td>
                  <td className="px-4 py-3 font-semibold text-fuel-green">{person.role}</td>
                  <td className="px-4 py-3 text-slate-600">{person.phone || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{person.email || "-"}</td>
                  <td className="px-4 py-3"><Pill tone={person.active ? "green" : "slate"}>{person.active ? "Active" : "Inactive"}</Pill></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button className={softButton} onClick={() => startEdit(person)}>Edit</button>
                      {person.active && <button className={dangerButton} onClick={() => deactivate(person)}>Deactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-3 lg:hidden">
          {filteredStaff.map((person) => (
            <Card key={person.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold">{person.name}</p>
                  <p className="font-semibold text-fuel-green">{person.role}</p>
                  <p className="text-sm text-slate-600">{person.phone || "No phone"}</p>
                  <p className="truncate text-sm text-slate-600">{person.email || "No email"}</p>
                </div>
                <Pill tone={person.active ? "green" : "slate"}>{person.active ? "Active" : "Inactive"}</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className={softButton} onClick={() => startEdit(person)}>Edit</button>
                <button className={person.active ? dangerButton : softButton} onClick={() => deactivate(person)} disabled={!person.active}>
                  {person.active ? "Deactivate" : "Inactive"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </Status>
    </div>
  );
}
