import React from "react";
import { AlertTriangle, Clock, Database, History, ImagePlus, KeyRound, MapPin, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, darkButton, primaryButton, softButton } from "../components/PageHeader.jsx";

const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "United Kingdom - Europe/London" },
  { value: "Europe/Dublin", label: "Ireland - Europe/Dublin" },
  { value: "Europe/Paris", label: "Western Europe - Europe/Paris" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Colombo", label: "Sri Lanka - Asia/Colombo" },
  { value: "Asia/Dubai", label: "UAE - Asia/Dubai" },
  { value: "America/New_York", label: "US Eastern - America/New_York" }
];

const DEFAULT_UK_ROTA_RULES = {
  warnShiftOver6HoursNoBreak: true,
  thresholdHours: 6,
  minimumBreakMinutes: 20,
  warnLessThan11HoursRest: true,
  dailyRestHours: 11,
  warnHighWeeklyHours: false,
  weeklyHoursThreshold: 48,
  warnBelowMinimumWage: false,
  minimumHourlyRate: 12.21,
  clockInEnabled: false,
  locationCheckEnabled: false,
  wageCostEnabled: false,
  showWageCostOnDashboard: false
};

export function Settings({ branding, onBrandingSaved }) {
  const [form, setForm] = React.useState(branding);
  const [staff, setStaff] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [audit, setAudit] = React.useState([]);
  const [openingHours, setOpeningHours] = React.useState({ openingStart: "05:30", openingEnd: "22:00", businessTimezone: "Europe/London" });
  const [ukRules, setUkRules] = React.useState(DEFAULT_UK_ROTA_RULES);
  const [adminForm, setAdminForm] = React.useState({ username: "", password: "admin123" });
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [toast, setToast] = React.useState("");
  const [confirmUkRulesSave, setConfirmUkRulesSave] = React.useState(false);
  const [savingUkRules, setSavingUkRules] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);

  React.useEffect(() => {
    setForm(branding);
  }, [branding]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showSavedPopup = (text) => {
    setMessage(text);
    setToast(text);
    window.dispatchEvent(new CustomEvent("localops:settings-saved", { detail: { message: text } }));
  };

  const loadAdminData = React.useCallback(() => {
    Promise.all([api.staff(), api.users(), api.openingHours(), api.ukRotaRules(), api.audit()])
      .then(([staffRows, userRows, hours, rules, auditRows]) => {
        const activeStaff = staffRows.filter((person) => person.active);
        setStaff(activeStaff);
        setUsers(userRows);
        setOpeningHours(hours);
        setUkRules({ ...DEFAULT_UK_ROTA_RULES, ...rules });
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
      showSavedPopup("Branding updated.");
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
      showSavedPopup("Opening hours updated.");
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveUkRules = async (event) => {
    event.preventDefault();
    setConfirmUkRulesSave(true);
  };

  const confirmSaveUkRules = async () => {
    setSavingUkRules(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.updateUkRotaRules(ukRules);
      setUkRules({ ...DEFAULT_UK_ROTA_RULES, ...saved });
      showSavedPopup("UK rota rules updated.");
      setConfirmUkRulesSave(false);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingUkRules(false);
    }
  };

  const updateUkRule = (key, value) => {
    setUkRules((current) => {
      return { ...current, [key]: value };
    });
  };

  const createAdmin = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createUser({ username: adminForm.username, password: adminForm.password, role: "admin", staffId: null, active: true });
      setAdminForm({ username: "", password: "admin123" });
      showSavedPopup("Admin login created.");
      loadAdminData();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleUser = async (user) => {
    await api.updateUser(user.id, { active: !user.active });
    showSavedPopup(`Login ${user.active ? "disabled" : "enabled"} for ${user.username}.`);
    loadAdminData();
  };

  const resetPassword = async (user) => {
    await api.resetPassword(user.id, { password: user.role === "admin" ? "admin123" : "staff123" });
    showSavedPopup(`Password reset for ${user.username}.`);
    loadAdminData();
  };

  const seedDemoData = async () => {
    setSeeding(true);
    setError("");
    setMessage("");
    try {
      const result = await api.seedDemoData({ count: 20 });
      showSavedPopup(`Demo data added: ${result.created} shifts created${result.skipped ? `, ${result.skipped} duplicates skipped` : ""}.`);
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {confirmUkRulesSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-fuel-line bg-white p-5 text-fuel-ink shadow-lift">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
                <AlertTriangle size={22} />
              </span>
              <div>
                <h3 className="text-xl font-black">Save UK Rota Rules?</h3>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  These optional checks will update dashboard warnings and planning summaries.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={softButton}
                onClick={() => setConfirmUkRulesSave(false)}
                disabled={savingUkRules}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={confirmSaveUkRules}
                disabled={savingUkRules}
              >
                <Save size={18} />
                {savingUkRules ? "Saving..." : "Save Rules"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-4 top-20 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-fuel-line bg-white p-4 text-fuel-ink shadow-lift" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
              <ShieldCheck size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-fuel-green">Saved</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{toast}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Dashboard checks will use the latest settings.</p>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-fuel-mist text-fuel-green hover:bg-fuel-line"
              onClick={() => setToast("")}
              aria-label="Close saved message"
            >
              X
            </button>
          </div>
        </div>
      )}

      <PageHeader
        eyebrow="Admin Control"
        title="Business Settings"
        description="Manage the business name, logo, rota hours, login access, and audit history from one place."
        meta={(
          <Pill>
            <ShieldCheck size={18} />
            Admin only
          </Pill>
        )}
      />

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
                  <label className={`${primaryButton} cursor-pointer`}>
                    <ImagePlus size={18} />
                    Upload logo
                    <input className="hidden" type="file" accept="image/*" onChange={chooseLogo} />
                  </label>
                  <button
                    type="button"
                    className={softButton}
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
            className={`${darkButton} w-full sm:w-auto`}
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
          <button className={`${primaryButton} self-end`}>
            <Save size={18} />
            Save
          </button>
        </form>
      </Card>

      <Card className="p-0">
        <SectionHeader
          icon={<AlertTriangle size={20} />}
          title="UK Rota Rules"
          description="Optional planning warnings for common UK rota and working-time checks."
        />
        <form className="space-y-4 px-5 pb-5" onSubmit={saveUkRules}>
          <div className="grid gap-3 lg:grid-cols-2">
            <RuleCard
              checked={ukRules.warnShiftOver6HoursNoBreak}
              onChange={(value) => updateUkRule("warnShiftOver6HoursNoBreak", value)}
              title="Break warning"
              description="Warn when a shift is over the threshold and the break is too short."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberInput disabled={!ukRules.warnShiftOver6HoursNoBreak} label="Threshold hours" value={ukRules.thresholdHours} onChange={(value) => updateUkRule("thresholdHours", value)} />
                <NumberInput disabled={!ukRules.warnShiftOver6HoursNoBreak} label="Minimum break mins" value={ukRules.minimumBreakMinutes} onChange={(value) => updateUkRule("minimumBreakMinutes", value)} />
              </div>
            </RuleCard>

            <RuleCard
              checked={ukRules.warnLessThan11HoursRest}
              onChange={(value) => updateUkRule("warnLessThan11HoursRest", value)}
              title="Daily rest warning"
              description="Warn when the gap between two shifts is below the configured rest hours."
            >
              <NumberInput disabled={!ukRules.warnLessThan11HoursRest} label="Daily rest hours" value={ukRules.dailyRestHours} onChange={(value) => updateUkRule("dailyRestHours", value)} />
            </RuleCard>

            <RuleCard
              checked={ukRules.warnHighWeeklyHours}
              onChange={(value) => updateUkRule("warnHighWeeklyHours", value)}
              title="Weekly hours warning"
              description="Warn when a staff member's weekly paid hours are above the threshold."
            >
              <NumberInput disabled={!ukRules.warnHighWeeklyHours} label="Weekly hours threshold" value={ukRules.weeklyHoursThreshold} onChange={(value) => updateUkRule("weeklyHoursThreshold", value)} />
            </RuleCard>

            <RuleCard
              checked={ukRules.warnBelowMinimumWage}
              onChange={(value) => updateUkRule("warnBelowMinimumWage", value)}
              title="Minimum wage warning"
              description="Prepare for hourly-rate checks when wage planning is enabled."
              helper="Check current rates on GOV.UK."
            >
              <NumberInput disabled={!ukRules.warnBelowMinimumWage} label="Minimum hourly rate" step="0.01" value={ukRules.minimumHourlyRate} onChange={(value) => updateUkRule("minimumHourlyRate", value)} prefix="GBP" />
            </RuleCard>

            <RuleCard
              checked={ukRules.clockInEnabled}
              onChange={(value) => updateUkRule("clockInEnabled", value)}
              title="Clock In / Out"
              description="Enable clock-in features when the business is ready to use them."
            />

            <RuleCard
              checked={ukRules.locationCheckEnabled}
              onChange={(value) => updateUkRule("locationCheckEnabled", value)}
              title="Location Check"
              description="Require location permission when staff clock in or out."
              helper="Location is only checked when staff clock in or out. The app does not track staff continuously."
              icon={<MapPin size={18} />}
            />

            <RuleCard
              checked={ukRules.wageCostEnabled}
              onChange={(value) => updateUkRule("wageCostEnabled", value)}
              title="Estimated Wage Cost"
              description="Enable estimated wage planning fields and summaries."
              helper="Estimated wage cost is for planning only and does not replace payroll."
            />

            <RuleCard
              checked={ukRules.showWageCostOnDashboard}
              onChange={(value) => updateUkRule("showWageCostOnDashboard", value)}
              title="Show wage cost on dashboard"
              description="Display estimated wage cost only when wage planning is enabled."
            />
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            LocalOps Planner provides rota, reminder, task and estimated wage planning tools only. It does not replace legal, HR, payroll, tax or employment advice. Employers remain responsible for following UK employment law and payroll rules.
          </div>

          <button className={`${primaryButton} w-full sm:w-auto`}>
            <Save size={18} />
            Save UK Rota Rules
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
          <button className={`${darkButton} self-end`}>Create Admin</button>
        </form>

        <div className="space-y-2 border-t border-fuel-line px-5 py-5">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-fuel-green">Existing logins</p>
          {users.map((user) => (
            <div key={user.id} className="grid gap-2 rounded-md border border-fuel-line bg-white p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-black">{user.username}</p>
                <p className="text-sm font-bold text-slate-600">{user.role}{user.staffName ? ` - ${user.staffName}` : ""}</p>
              </div>
              <button className={softButton} onClick={() => resetPassword(user)}>
                Reset
              </button>
              <button className={user.active ? "inline-flex min-h-11 items-center justify-center rounded-md bg-red-50 px-4 py-2.5 text-sm font-black text-red-700" : primaryButton} onClick={() => toggleUser(user)}>
                {user.active ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <SectionHeader
          icon={<Database size={20} />}
          title="Demo Data"
          description="Create test shifts in the current database so you can check rota, reminders, and Supabase rows."
        />
        <div className="space-y-3 px-5 pb-5">
          <p className="text-sm font-bold text-slate-600">
            This adds 20 demo shifts across active staff. It skips exact duplicates and records the action in the audit log.
          </p>
          <button type="button" className={primaryButton} onClick={seedDemoData} disabled={seeding || staff.length === 0}>
            <Database size={18} />
            {seeding ? "Adding demo shifts..." : "Seed 20 demo shifts"}
          </button>
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

function RuleCard({ checked, children, description, disabled = false, helper, icon, onChange, title }) {
  const isOn = Boolean(checked);

  return (
    <div className={`rounded-lg border border-fuel-line bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
      <label className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-fuel-green"
          checked={isOn}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-base font-black text-fuel-ink">
            {icon}
            {title}
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-600">{description}</span>
          {helper && <span className="mt-2 block rounded-md bg-fuel-mist px-3 py-2 text-xs font-bold text-slate-600">{helper}</span>}
        </span>
      </label>
      {children && isOn && <div className="mt-4 border-t border-fuel-line pt-4">{children}</div>}
      {children && !isOn && (
        <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
          This rule is off and will not affect dashboard warnings.
        </div>
      )}
    </div>
  );
}

function NumberInput({ disabled = false, label, onChange, prefix, step = "1", value }) {
  return (
    <Field label={label}>
      <div className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
        {prefix && <span className="rounded-md bg-fuel-mist px-3 py-3 text-sm font-black text-fuel-green">{prefix}</span>}
        <input
          type="number"
          min="0"
          step={step}
          className={inputClass}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </Field>
  );
}
