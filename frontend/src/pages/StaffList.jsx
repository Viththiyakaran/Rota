import React from "react";
import { Mail, Pencil, Phone, PlusCircle, Search, UserCheck, Users, UserX, X } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { AvatarField } from "../components/AvatarField.jsx";
import { StaffAvatar } from "../components/StaffAvatar.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, dangerButton, primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";

export function StaffList({ goTo }) {
  const [staff, setStaff] = React.useState([]);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("active");

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    api.staff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const activeCount = staff.filter((person) => person.active).length;
  const inactiveCount = staff.length - activeCount;
  const roleCount = new Set(staff.filter((person) => person.active).map((person) => person.role)).size;
  const filteredStaff = staff.filter((person) => {
    const matchesStatus = filter === "all" || (filter === "active" ? person.active : !person.active);
    const text = `${person.name} ${person.role} ${person.phone || ""} ${person.email || ""}`.toLowerCase();
    return matchesStatus && text.includes(query.trim().toLowerCase());
  });

  const startEdit = (person) => {
    setEditingId(person.id);
    setForm({ ...person });
    setError("");
  };

  const closeEdit = () => {
    if (saving) return;
    setEditingId(null);
    setForm({});
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.updateStaff(editingId, form);
      setEditingId(null);
      setForm({});
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (person) => {
    const nextActive = !person.active;
    if (!nextActive && !window.confirm(`Deactivate ${person.name}? Their previous rota records will be kept.`)) return;
    setError("");
    try {
      await api.updateStaff(person.id, { active: nextActive });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        eyebrow="Team"
        title="Staff"
        description="Find people quickly, update their details, and control who appears on the rota."
        action={(
          <button type="button" className={primaryButton} onClick={() => goTo("add-staff")}>
            <PlusCircle size={18} />
            Add Staff
          </button>
        )}
      />

      <section className="grid grid-cols-3 gap-3">
        <TeamMetric icon={UserCheck} label="Active" value={activeCount} tone="green" />
        <TeamMetric icon={UserX} label="Inactive" value={inactiveCount} tone="slate" />
        <TeamMetric icon={Users} label="Roles" value={roleCount} tone="blue" />
      </section>

      <Card className="p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <span className="sr-only">Search staff</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className={`${inputClass} pl-10`}
              placeholder="Search name, role, phone or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" aria-label="Filter staff">
            {[
              ["active", `Active ${activeCount}`],
              ["inactive", `Inactive ${inactiveCount}`],
              ["all", `All ${staff.length}`]
            ].map(([option, label]) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`min-h-10 rounded-md px-3 text-sm font-bold transition ${
                  filter === option ? "bg-white text-fuel-green shadow-sm" : "text-slate-500 hover:text-fuel-green"
                }`}
                aria-pressed={filter === option}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500">
          Showing {filteredStaff.length} of {staff.length} staff
        </p>
      </Card>

      <Status loading={loading} error={error}>
        {filteredStaff.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredStaff.map((person) => (
              <StaffCard
                key={person.id}
                person={person}
                onEdit={() => startEdit(person)}
                onToggleStatus={() => toggleStatus(person)}
              />
            ))}
          </section>
        ) : (
          <Card className="py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fuel-mist text-fuel-green">
              <Search size={22} />
            </span>
            <h3 className="mt-3 font-black text-fuel-ink">No matching staff</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Try another search or choose a different status.</p>
          </Card>
        )}
      </Status>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onSubmit={save}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-fuel-line bg-white px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-fuel-green">Staff profile</p>
                <h2 className="mt-1 text-xl font-black text-fuel-ink">Edit {form.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Update contact details, role, or rota access.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close staff editor"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700 md:col-span-2">{error}</p>}
              <div className="md:col-span-2">
                <AvatarField name={form.name || "Staff"} value={form.avatarDataUrl || ""} onChange={(avatarDataUrl) => setForm({ ...form, avatarDataUrl })} />
              </div>
              <Field label="Name">
                <input required className={inputClass} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Role">
                <input required className={inputClass} value={form.role || ""} onChange={(event) => setForm({ ...form, role: event.target.value })} />
              </Field>
              <Field label="Phone">
                <input className={inputClass} inputMode="tel" placeholder="07123 456789" value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="Email">
                <input className={inputClass} type="email" placeholder="name@example.com" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <Field label="Rota status">
                <select className={inputClass} value={form.active ? "true" : "false"} onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}>
                  <option value="true">Active — appears on rota</option>
                  <option value="false">Inactive — hidden from rota</option>
                </select>
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-fuel-line bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" className={softButton} onClick={closeEdit} disabled={saving}>Cancel</button>
              <button type="submit" className={primaryButton} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TeamMetric({ icon: Icon, label, tone, value }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-fuel-mist text-fuel-green"
  };
  return (
    <Card className="flex items-center gap-3 p-3 sm:p-4">
      <span className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${tones[tone]}`}>
        <Icon size={20} />
      </span>
      <span>
        <span className="block text-xl font-black leading-none text-fuel-ink sm:text-2xl">{value}</span>
        <span className="mt-1 block text-xs font-bold text-slate-500">{label}</span>
      </span>
    </Card>
  );
}

function StaffCard({ onEdit, onToggleStatus, person }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 p-4">
        <StaffAvatar avatarDataUrl={person.avatarDataUrl} className="h-12 w-12 text-lg" name={person.name} rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-fuel-ink">{person.name}</h3>
              <p className="mt-0.5 text-sm font-bold text-fuel-green">{person.role}</p>
            </div>
            <Pill tone={person.active ? "green" : "slate"}>{person.active ? "Active" : "Inactive"}</Pill>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-y border-fuel-line bg-slate-50/70 px-4 py-3">
        <ContactRow icon={Phone} href={person.phone ? `tel:${person.phone}` : ""} text={person.phone || "No phone added"} />
        <ContactRow icon={Mail} href={person.email ? `mailto:${person.email}` : ""} text={person.email || "No email added"} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 p-3">
        <button type="button" className={softButton} onClick={onEdit}>
          <Pencil size={16} />
          Edit Profile
        </button>
        <button
          type="button"
          className={person.active ? dangerButton : primaryButton}
          onClick={onToggleStatus}
          title={person.active ? "Deactivate staff" : "Reactivate staff"}
        >
          {person.active ? <UserX size={17} /> : <UserCheck size={17} />}
          <span className="hidden sm:inline">{person.active ? "Deactivate" : "Reactivate"}</span>
        </button>
      </div>
    </Card>
  );
}

function ContactRow({ href, icon: Icon, text }) {
  const content = (
    <>
      <Icon size={16} className="shrink-0 text-slate-400" />
      <span className="truncate">{text}</span>
    </>
  );
  return href ? (
    <a className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-fuel-green" href={href}>{content}</a>
  ) : (
    <p className="flex items-center gap-2 text-sm font-semibold text-slate-400">{content}</p>
  );
}
