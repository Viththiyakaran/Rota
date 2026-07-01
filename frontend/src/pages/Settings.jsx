import React from "react";
import { Clock, History, ImagePlus, KeyRound, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";

const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "United Kingdom - Europe/London" },
  { value: "Europe/Dublin", label: "Ireland - Europe/Dublin" },
  { value: "Europe/Paris", label: "Western Europe - Europe/Paris" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Colombo", label: "Sri Lanka - Asia/Colombo" },
  { value: "Asia/Dubai", label: "UAE - Asia/Dubai" },
  { value: "America/New_York", label: "US Eastern - America/New_York" }
];

export function Settings({ branding, onBrandingSaved }) {
  const [form, setForm] = React.useState(branding);
  const [staff, setStaff] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [audit, setAudit] = React.useState([]);
  const [openingHours, setOpeningHours] = React.useState({ openingStart: "05:30", openingEnd: "22:00", businessTimezone: "Europe/London" });
  const [adminForm, setAdminForm] = React.useState({ username: "", password: "admin123" });
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
      onBrandingSaved({ ...branding, businessTimezone: saved.businessTimezone });
      setMessage("Opening hours updated.");
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const createAdmin = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createUser({ username: adminForm.username, password: adminForm.password, role: "admin", staffId: null, active: true });
      setAdminForm({ username: "", password: "admin123" });
      setMessage("Admin login created.");
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
    <div className="space-y-5 pb-8">
      <div className="rounded-lg border border-fuel-line bg-white/95 p-5 shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-fuel-green">Admin Control</p>
            <h2 className="mt-1 text-3xl font-black sm:text-4xl">Business Settings</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold text-slate-600">
              Manage the business name, logo, rota hours, login access, and audit history from one place.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green">
            <ShieldCheck size={18} />
            Admin only
          </div>
        </div>
      </div>

      <Card className="p-0">
        <form className="space-y-4" onSubmit={save}>
          <SectionHeader
            icon={<ImagePlus size={20} />}
            title="Branding"
            description="This name and logo appear in the header, browser title, rota printouts, and staff screens."
          />

          <div className="space-y-4 px-5 pb-5">
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

          <div className="rounded-lg border border-fuel-line bg-fuel-mist/60 p-4">
            <p className="mb-3 text-sm font-black text-slate-700">Logo image</p>
            <div className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-fuel-line bg-white shadow-sm">
                {form.logoDataUrl ? (
                  <img src={form.logoDataUrl} alt="" className="h-full w-full rounded-lg object-contain p-2" />
                ) : (
                  <span className="text-2xl font-black text-fuel-green">
                    {String(form.businessName || "R").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-fuel-green px-4 py-3 font-black text-white shadow-soft transition hover:bg-fuel-green/90">
                    <ImagePlus size={18} />
                    Upload logo
                    <input className="hidden" type="file" accept="image/*" onChange={chooseLogo} />
                  </label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-3 font-black text-fuel-green ring-1 ring-fuel-line transition hover:bg-fuel-mist"
                    onClick={() => setForm({ ...form, logoDataUrl: "" })}
                  >
                    <RotateCcw size={18} />
                    Remove
                  </button>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">Use a square PNG/JPG under 500KB for the cleanest header display.</p>
              </div>
            </div>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-fuel-ink px-5 py-4 font-black text-white shadow-lift transition hover:bg-fuel-ink/95 disabled:opacity-60 sm:w-auto"
            disabled={saving}
          >
            <Save size={20} />
            {saving ? "Saving..." : "Save Branding"}
          </button>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <SectionHeader
          icon={<Clock size={20} />}
          title="Business Opening Hours"
          description="These hours and timezone control shift ranges, reminders, and calendar sync."
        />
        <form className="grid gap-4 px-5 pb-5 lg:grid-cols-[1fr_1fr_1.5fr_auto]" onSubmit={saveOpeningHours}>
          <Field label="Open">
            <input type="time" className={inputClass} value={openingHours.openingStart} onChange={(e) => setOpeningHours({ ...openingHours, openingStart: e.target.value })} />
          </Field>
          <Field label="Close">
            <input type="time" className={inputClass} value={openingHours.openingEnd} onChange={(e) => setOpeningHours({ ...openingHours, openingEnd: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <select
              className={inputClass}
              value={openingHours.businessTimezone || "Europe/London"}
              onChange={(e) => setOpeningHours({ ...openingHours, businessTimezone: e.target.value })}
            >
              {TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>{timezone.label}</option>
              ))}
            </select>
          </Field>
          <button className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-fuel-green px-5 py-4 font-black text-white shadow-soft transition hover:bg-fuel-green/90">
            <Save size={18} />
            Save
          </button>
        </form>
      </Card>

      <Card className="p-0">
        <SectionHeader
          icon={<KeyRound size={20} />}
          title="Login Access"
          description="Staff logins are created automatically when staff are added. Create extra admin users here."
        />

        <form className="grid gap-4 px-5 pb-5 md:grid-cols-[1fr_1fr_auto]" onSubmit={createAdmin}>
          <Field label="Username">
            <input className={inputClass} value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} />
          </Field>
          <Field label="Password">
            <input className={inputClass} value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
          </Field>
          <button className="self-end rounded-md bg-fuel-ink px-5 py-4 font-black text-white">Create Admin</button>
        </form>

        <div className="space-y-2 border-t border-fuel-line px-5 py-5">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-fuel-green">Existing logins</p>
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

      <Card className="p-0">
        <SectionHeader
          icon={<History size={20} />}
          title="Audit Log"
          description="Recent changes made by admins and system actions."
        />
        <div className="max-h-96 space-y-2 overflow-auto px-5 pb-5">
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

function SectionHeader({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3 border-b border-fuel-line px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-fuel-mist text-fuel-green">
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-1 text-sm font-bold text-slate-600">{description}</p>
      </div>
    </div>
  );
}
