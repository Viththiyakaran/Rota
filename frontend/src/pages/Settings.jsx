import React from "react";
import { ImagePlus, RotateCcw, Save } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";

export function Settings({ branding, onBrandingSaved }) {
  const [form, setForm] = React.useState(branding);
  const [staff, setStaff] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [audit, setAudit] = React.useState([]);
  const [openingHours, setOpeningHours] = React.useState({ openingStart: "05:30", openingEnd: "22:00" });
  const [userForm, setUserForm] = React.useState({ username: "", password: "staff123", role: "staff", staffId: "", active: true });
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(branding);
  }, [branding]);

  const loadAdminData = React.useCallback(() => {
    Promise.all([api.staff(), api.users(), api.openingHours(), api.audit()])
      .then(([staffRows, userRows, hours, auditRows]) => {
        const activeStaff = staffRows.filter((person) => person.active);
        setStaff(activeStaff);
        setUsers(userRows);
        setOpeningHours(hours);
        setAudit(auditRows);
        setUserForm((current) => ({ ...current, staffId: current.staffId || activeStaff[0]?.id || "" }));
      })
      .catch((err) => setError(err.message));
  }, []);

  React.useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    setError("");
    setMessage("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the logo.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Logo image is too large. Use an image under 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, logoDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const saved = await api.updateBranding(form);
      onBrandingSaved(saved);
      setMessage("Branding updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveOpeningHours = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const saved = await api.updateOpeningHours(openingHours);
      setOpeningHours(saved);
      setMessage("Opening hours updated.");
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createUser({ ...userForm, staffId: userForm.role === "staff" ? userForm.staffId : null });
      setUserForm({ username: "", password: "staff123", role: "staff", staffId: staff[0]?.id || "", active: true });
      setMessage("Login created.");
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleUser = async (user) => {
    await api.updateUser(user.id, { active: !user.active });
    loadAdminData();
  };

  const resetPassword = async (user) => {
    await api.resetPassword(user.id, { password: user.role === "admin" ? "admin123" : "staff123" });
    setMessage(`Password reset for ${user.username}.`);
    loadAdminData();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-fuel-green">Admin</p>
        <h2 className="text-3xl font-black">Business Settings</h2>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={save}>
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p>}
          {message && <p className="rounded-md bg-fuel-mist p-3 font-bold text-fuel-green">{message}</p>}

          <Field label="Business name">
            <input
              required
              className={inputClass}
              value={form.businessName || ""}
              onChange={(event) => setForm({ ...form, businessName: event.target.value })}
              placeholder="Your business name"
            />
          </Field>

          <Field label="Logo image">
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-fuel-line bg-fuel-mist">
                {form.logoDataUrl ? (
                  <img src={form.logoDataUrl} alt="" className="h-full w-full rounded-md object-contain p-1" />
                ) : (
                  <span className="text-2xl font-black text-fuel-green">
                    {String(form.businessName || "R").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-fuel-green px-4 py-3 font-black text-white shadow-soft">
                  <ImagePlus size={18} />
                  Upload Logo
                  <input className="hidden" type="file" accept="image/*" onChange={chooseLogo} />
                </label>
                <button
                  type="button"
                  className="ml-2 inline-flex items-center gap-2 rounded-md bg-fuel-mist px-4 py-3 font-black text-fuel-green"
                  onClick={() => setForm({ ...form, logoDataUrl: "" })}
                >
                  <RotateCcw size={18} />
                  Remove
                </button>
                <p className="text-xs font-bold text-slate-500">Use a square PNG/JPG under 500KB.</p>
              </div>
            </div>
          </Field>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-fuel-ink px-5 py-4 text-lg font-black text-white shadow-lift disabled:opacity-60"
            disabled={saving}
          >
            <Save size={20} />
            {saving ? "Saving..." : "Save Branding"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-xl font-black">Business Opening Hours</h3>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={saveOpeningHours}>
          <Field label="Open">
            <input type="time" className={inputClass} value={openingHours.openingStart} onChange={(e) => setOpeningHours({ ...openingHours, openingStart: e.target.value })} />
          </Field>
          <Field label="Close">
            <input type="time" className={inputClass} value={openingHours.openingEnd} onChange={(e) => setOpeningHours({ ...openingHours, openingEnd: e.target.value })} />
          </Field>
          <button className="self-end rounded-md bg-fuel-green px-5 py-4 font-black text-white">Save</button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-xl font-black">Admin User Management</h3>
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createUser}>
          <Field label="Username">
            <input className={inputClass} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
          </Field>
          <Field label="Password">
            <input className={inputClass} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Staff link">
            <select className={inputClass} value={userForm.staffId} onChange={(e) => setUserForm({ ...userForm, staffId: e.target.value })} disabled={userForm.role === "admin"}>
              {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </Field>
          <button className="self-end rounded-md bg-fuel-ink px-5 py-4 font-black text-white">Create</button>
        </form>

        <div className="mt-4 space-y-2">
          {users.map((user) => (
            <div key={user.id} className="grid gap-2 rounded-md border border-fuel-line bg-white p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-black">{user.username}</p>
                <p className="text-sm font-bold text-slate-600">{user.role}{user.staffName ? ` - ${user.staffName}` : ""}</p>
              </div>
              <button className="rounded-md bg-fuel-mist px-3 py-2 font-black text-fuel-green" onClick={() => resetPassword(user)}>
                Reset
              </button>
              <button className={`rounded-md px-3 py-2 font-black ${user.active ? "bg-red-50 text-red-700" : "bg-fuel-green text-white"}`} onClick={() => toggleUser(user)}>
                {user.active ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-xl font-black">Audit Log</h3>
        <div className="max-h-96 space-y-2 overflow-auto">
          {audit.map((item) => (
            <div key={item.id} className="rounded-md bg-fuel-mist p-3">
              <p className="font-black">{item.action.replaceAll("_", " ")}</p>
              <p className="text-sm font-bold text-slate-600">{item.details}</p>
              <p className="text-xs text-slate-500">{item.username || "System"} - {new Date(item.createdAt).toLocaleString("en-GB")}</p>
            </div>
          ))}
          {audit.length === 0 && <p className="text-sm font-bold text-slate-500">No audit entries yet.</p>}
        </div>
      </Card>
    </div>
  );
}
