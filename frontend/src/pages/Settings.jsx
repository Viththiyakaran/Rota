import React from "react";
import { AlertTriangle, Building2, ClipboardList, Clock, History, ImagePlus, KeyRound, MapPin, PackageCheck, Plus, RotateCcw, Save, ShieldCheck, ShoppingCart, SlidersHorizontal, Trash2, TrendingUp } from "lucide-react";
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
const DEFAULT_SHIFT_RANGE_PRESETS = [
  { label: "Morning", startTime: "05:30", endTime: "14:00" },
  { label: "Day", startTime: "05:30", endTime: "19:00" },
  { label: "Full day", startTime: "05:30", endTime: "22:00" },
  { label: "Afternoon", startTime: "13:00", endTime: "22:00" },
  { label: "Late", startTime: "14:00", endTime: "22:00" },
  { label: "Evening", startTime: "18:00", endTime: "22:00" }
];
const UK_ROTA_RULES_CACHE_KEY = "localops.ukRotaRules";
const SETTINGS_SECTIONS = [
  { id: "business", label: "Business", description: "Branding and optional features", icon: Building2 },
  { id: "rota", label: "Rota rules", description: "Hours, presets and planning rules", icon: SlidersHorizontal },
  { id: "tasks", label: "Tasks", description: "Enable gas and order tasks", icon: ClipboardList },
  { id: "access", label: "Login access", description: "Admin and staff accounts", icon: KeyRound },
  { id: "activity", label: "Activity", description: "Recent admin changes", icon: History }
];

function normaliseUkRules(rules = {}) {
  return { ...DEFAULT_UK_ROTA_RULES, ...rules };
}

function readCachedUkRules() {
  try {
    const cached = window.localStorage.getItem(UK_ROTA_RULES_CACHE_KEY);
    return cached ? normaliseUkRules(JSON.parse(cached)) : DEFAULT_UK_ROTA_RULES;
  } catch {
    return DEFAULT_UK_ROTA_RULES;
  }
}

function cacheUkRules(rules) {
  try {
    window.localStorage.setItem(UK_ROTA_RULES_CACHE_KEY, JSON.stringify(rules));
  } catch {
    // Local cache is only a convenience; database save is still the source of truth.
  }
}

export function Settings({ branding, goTo, initialSection = "business", onBrandingSaved }) {
  const [activeSection, setActiveSection] = React.useState(initialSection);
  const [form, setForm] = React.useState(branding);
  const [users, setUsers] = React.useState([]);
  const [staff, setStaff] = React.useState([]);
  const [audit, setAudit] = React.useState([]);
  const [openingHours, setOpeningHours] = React.useState({
    openingStart: "05:30",
    openingEnd: "22:00",
    businessTimezone: "Europe/London",
    shiftRangePresets: DEFAULT_SHIFT_RANGE_PRESETS
  });
  const [newRange, setNewRange] = React.useState({ label: "", startTime: "09:00", endTime: "17:00" });
  const [ukRules, setUkRules] = React.useState(readCachedUkRules);
  const [gasStockConfig, setGasStockConfig] = React.useState({ enabled: true, weekday: 6, assignedStaffId: null, products: [] });
  const [orderSchedules, setOrderSchedules] = React.useState([]);
  const [savingScheduleId, setSavingScheduleId] = React.useState(null);
  const [savedUkRules, setSavedUkRules] = React.useState(readCachedUkRules);
  const [adminForm, setAdminForm] = React.useState({ username: "", password: "" });
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [toast, setToast] = React.useState("");
  const [confirmUkRulesSave, setConfirmUkRulesSave] = React.useState(false);
  const [savingUkRules, setSavingUkRules] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(branding);
  }, [branding]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const ukRulesChanged = React.useMemo(
    () => JSON.stringify(ukRules) !== JSON.stringify(savedUkRules),
    [savedUkRules, ukRules]
  );

  const showSavedPopup = (text) => {
    setMessage(text);
    setToast(text);
    window.dispatchEvent(new CustomEvent("localops:settings-saved", { detail: { message: text } }));
  };

  const loadAdminData = React.useCallback(() => {
    Promise.all([api.users(), api.openingHours(), api.ukRotaRules(), api.audit(), api.gasStockSettings(), api.staff(), api.workSchedules()])
      .then(([userRows, hours, rules, auditRows, stockConfig, staffRows, schedules]) => {
        setUsers(userRows);
        setOpeningHours(hours);
        const loadedRules = normaliseUkRules(rules);
        setUkRules(loadedRules);
        setSavedUkRules(loadedRules);
        cacheUkRules(loadedRules);
        setAudit(auditRows);
        setGasStockConfig(stockConfig);
        setStaff(staffRows.filter((person) => person.active));
        setOrderSchedules(schedules);
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
      showSavedPopup("Business settings updated.");
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

  const saveGasStockSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.updateGasStockSettings(gasStockConfig);
      setGasStockConfig(saved);
      showSavedPopup("Gas stock settings updated. This week’s task is ready.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleOrderSchedule = async (schedule) => {
    setSavingScheduleId(schedule.id);
    setError("");
    setMessage("");
    try {
      const saved = await api.updateWorkSchedule(schedule.id, { active: !schedule.active });
      setOrderSchedules((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      showSavedPopup(`${saved.name} weekly order task ${saved.active ? "enabled" : "paused"}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingScheduleId(null);
    }
  };

  const addShiftRangePreset = () => {
    setError("");
    const nextRange = {
      label: String(newRange.label || "").trim() || `${formatTimeLabel(newRange.startTime)}-${formatTimeLabel(newRange.endTime)}`,
      startTime: newRange.startTime,
      endTime: newRange.endTime
    };
    if (!isValidTime(nextRange.startTime) || !isValidTime(nextRange.endTime)) {
      setError("Shift range start and end must be valid times.");
      return;
    }

    setOpeningHours((current) => {
      const existing = Array.isArray(current.shiftRangePresets) ? current.shiftRangePresets : [];
      const withoutDuplicate = existing.filter((range) => range.startTime !== nextRange.startTime || range.endTime !== nextRange.endTime);
      return {
        ...current,
        shiftRangePresets: [...withoutDuplicate, nextRange]
      };
    });
    setNewRange({ label: "", startTime: "09:00", endTime: "17:00" });
  };

  const removeShiftRangePreset = (target) => {
    setOpeningHours((current) => ({
      ...current,
      shiftRangePresets: (current.shiftRangePresets || []).filter((range) => range.startTime !== target.startTime || range.endTime !== target.endTime)
    }));
  };

  const saveUkRules = async (event) => {
    event.preventDefault();
    if (savingUkRules) return;
    if (!ukRulesChanged) {
      showSavedPopup("UK rota rules are already saved.");
      return;
    }
    setConfirmUkRulesSave(true);
  };

  const confirmSaveUkRules = async () => {
    const rulesToSave = normaliseUkRules(ukRules);
    setConfirmUkRulesSave(false);
    setSavingUkRules(true);
    setError("");
    setMessage("");
    setUkRules(rulesToSave);
    setSavedUkRules(rulesToSave);
    cacheUkRules(rulesToSave);
    try {
      const saved = await api.updateUkRotaRules(rulesToSave);
      const savedRules = normaliseUkRules(saved);
      setUkRules(savedRules);
      setSavedUkRules(savedRules);
      cacheUkRules(savedRules);
      showSavedPopup("UK rota rules updated.");
      loadAdminData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingUkRules(false);
    }
  };

  const updateUkRule = (key, value) => {
    setUkRules((current) => {
      const next = { ...current, [key]: value };
      if (key === "clockInEnabled" && !value) {
        next.locationCheckEnabled = false;
      }
      if (key === "locationCheckEnabled" && value) {
        next.clockInEnabled = true;
      }
      if (key === "wageCostEnabled" && !value) {
        next.showWageCostOnDashboard = false;
      }
      if (key === "showWageCostOnDashboard" && value) {
        next.wageCostEnabled = true;
      }
      return next;
    });
  };

  const createAdmin = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createUser({ username: adminForm.username, password: adminForm.password, role: "admin", staffId: null, active: true });
      setAdminForm({ username: "", password: "" });
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
    const confirmed = window.confirm(`Create a new temporary password for ${user.username}? They will need to change it after login.`);
    if (!confirmed) return;
    await api.resetPassword(user.id, { password: user.role === "admin" ? "AdminTemp123!" : "StaffTemp123!" });
    showSavedPopup(`Temporary password reset for ${user.username}.`);
    loadAdminData();
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
        title="Settings"
        description="Choose a section and update only what you need."
        meta={(
          <Pill>
            <ShieldCheck size={18} />
            Admin only
          </Pill>
        )}
      />

      <Card className="p-2">
        <nav className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  setError("");
                  setMessage("");
                }}
                className={`flex items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                  active ? "bg-fuel-green text-white shadow-sm" : "text-fuel-ink hover:bg-fuel-mist"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-black">{section.label}</span>
                  <span className={`mt-0.5 hidden text-xs font-semibold sm:block ${active ? "text-white/80" : "text-slate-500"}`}>
                    {section.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </Card>

      {error && <p className="rounded-lg bg-red-50 p-3 font-bold text-red-700">{error}</p>}
      {message && <p className="rounded-lg bg-fuel-mist p-3 font-bold text-fuel-green">{message}</p>}

      {activeSection === "business" ? (
      <div className="space-y-5">
      <Card className="p-0">
        <form className="space-y-4" onSubmit={save}>
          <SectionHeader
            icon={<ImagePlus size={20} />}
            title="Business Profile"
            description="Manage the business name, logo, and optional admin features."
          />

          <div className="space-y-4 px-5 pb-5">
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

          <div className="rounded-lg border border-fuel-line bg-white p-4">
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
                  <TrendingUp size={20} />
                </span>
                <span>
                  <span className="block font-black text-fuel-ink">Performance Tracker</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">
                    Show weekly sales comparisons in a separate admin menu.
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    Turning this off hides the page but keeps all saved sales figures.
                  </span>
                </span>
              </span>
              <span className="relative mt-1 inline-flex shrink-0 items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={form.performanceTrackerEnabled !== false}
                  onChange={(event) => setForm({ ...form, performanceTrackerEnabled: event.target.checked })}
                />
                <span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-fuel-green" />
                <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </span>
            </label>
          </div>

          <button
            className={`${darkButton} w-full sm:w-auto`}
            disabled={saving}
          >
            <Save size={20} />
            {saving ? "Saving..." : "Save Business Settings"}
          </button>
          </div>
        </form>
      </Card>

      </div>
      ) : null}

      {activeSection === "rota" ? (
      <div className="space-y-5">
      <Card className="p-0">
        <SectionHeader
          icon={<Clock size={20} />}
          title="Business Opening Hours"
          description="These hours and timezone control shift ranges, reminders, and calendar sync."
        />
        <form className="space-y-5 px-5 pb-5" onSubmit={saveOpeningHours}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
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
          </div>

          <div className="rounded-lg border border-fuel-line bg-fuel-mist/60 p-4">
            <div className="mb-4">
              <h4 className="font-black text-fuel-ink">Shift range presets</h4>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                These buttons appear in Add Shift. Use them for common rota times, and use custom start/end for unusual shifts.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Preset name">
                <input
                  className={inputClass}
                  value={newRange.label}
                  onChange={(event) => setNewRange({ ...newRange, label: event.target.value })}
                  placeholder="e.g. School run cover"
                />
              </Field>
              <Field label="Start">
                <input
                  type="time"
                  className={inputClass}
                  value={newRange.startTime}
                  onChange={(event) => setNewRange({ ...newRange, startTime: event.target.value })}
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  className={inputClass}
                  value={newRange.endTime}
                  onChange={(event) => setNewRange({ ...newRange, endTime: event.target.value })}
                />
              </Field>
              <button type="button" className={`${softButton} self-end`} onClick={addShiftRangePreset}>
                <Plus size={18} />
                Add preset
              </button>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(openingHours.shiftRangePresets || []).map((range) => (
                <div key={`${range.startTime}-${range.endTime}`} className="flex items-center justify-between gap-3 rounded-lg border border-fuel-line bg-white p-3">
                  <div>
                    <p className="font-black text-fuel-ink">{range.label || `${formatTimeLabel(range.startTime)}-${formatTimeLabel(range.endTime)}`}</p>
                    <p className="text-sm font-bold text-fuel-green">{formatTimeLabel(range.startTime)} - {formatTimeLabel(range.endTime)}</p>
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                    onClick={() => removeShiftRangePreset(range)}
                    aria-label={`Remove ${range.label || "shift range"}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {(!openingHours.shiftRangePresets || openingHours.shiftRangePresets.length === 0) && (
                <p className="rounded-lg bg-white p-3 text-sm font-bold text-slate-500">No presets yet. Add one above, then press Save.</p>
              )}
            </div>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <SectionHeader
          icon={<AlertTriangle size={20} />}
          title="UK Rota Rules"
          description="Optional planning warnings for common UK rota and working-time checks."
        />
        <form className="space-y-4 px-5 pb-5" onSubmit={saveUkRules}>
          <div className={`sticky top-16 z-20 flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            ukRulesChanged ? "border-amber-200 bg-amber-50 text-amber-900" : "border-fuel-line bg-fuel-mist text-fuel-ink"
          }`}>
            <div>
              <p className="font-black">
                {savingUkRules ? "Saving UK rota rules..." : ukRulesChanged ? "Unsaved UK rota rule changes" : "UK rota rules saved"}
              </p>
              <p className="text-sm font-semibold">
                {savingUkRules
                  ? "Please wait while the latest settings are stored."
                  : ukRulesChanged
                  ? "Press Save Rules before refreshing or leaving this page."
                  : "Dashboard checks are using these saved options."}
              </p>
            </div>
            <button
              type="submit"
              className={`${ukRulesChanged ? primaryButton : softButton} shrink-0`}
              disabled={!ukRulesChanged || savingUkRules}
            >
              <Save size={18} />
              {savingUkRules ? "Saving..." : "Save Rules"}
            </button>
          </div>

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
              disabled={!ukRules.clockInEnabled}
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
              disabled={!ukRules.wageCostEnabled}
            />
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            LocalPlanner provides rota, reminder, task and estimated wage planning tools only. It does not replace legal, HR, payroll, tax or employment advice. Employers remain responsible for following UK employment law and payroll rules.
          </div>

          <button className={`${primaryButton} w-full sm:w-auto`} disabled={!ukRulesChanged || savingUkRules}>
            <Save size={18} />
            {savingUkRules ? "Saving..." : ukRulesChanged ? "Save UK Rota Rules" : "UK Rota Rules Saved"}
          </button>
        </form>
      </Card>

      </div>
      ) : null}

      {activeSection === "tasks" ? (
        <div className="space-y-5">
        <Card className="p-0">
          <SectionHeader
            icon={<PackageCheck size={20} />}
            title="Gas Stock Task"
            description="Enable the weekly count and choose when it should appear for staff."
          />
          <form className="space-y-5 px-5 pb-5" onSubmit={saveGasStockSettings}>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-fuel-line bg-white p-4">
              <span>
                <span className="block font-black text-fuel-ink">Enable weekly gas stock task</span>
                <span className="mt-1 block text-sm font-semibold text-slate-600">LocalPlanner creates the task automatically. Submitting the count marks it complete.</span>
              </span>
              <span className="relative mt-1 inline-flex shrink-0 items-center">
                <input type="checkbox" className="peer sr-only" checked={gasStockConfig.enabled !== false} onChange={(event) => setGasStockConfig({ ...gasStockConfig, enabled: event.target.checked })} />
                <span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-fuel-green" />
                <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Task due day">
                <select className={inputClass} value={gasStockConfig.weekday ?? 6} onChange={(event) => setGasStockConfig({ ...gasStockConfig, weekday: Number(event.target.value) })}>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
              </Field>
              <Field label="Assign weekly count to">
                <select className={inputClass} value={gasStockConfig.assignedStaffId || ""} onChange={(event) => setGasStockConfig({ ...gasStockConfig, assignedStaffId: event.target.value ? Number(event.target.value) : null })}>
                  <option value="">Anyone</option>
                  {staff.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
                </select>
              </Field>
            </div>

            <div className="overflow-hidden rounded-lg border border-fuel-line">
              <div className="grid grid-cols-[minmax(0,1fr)_96px_52px] gap-2 bg-slate-50 px-3 py-3 text-xs font-black uppercase tracking-wide text-slate-500 sm:grid-cols-[minmax(0,1fr)_120px_76px] sm:gap-3 sm:px-4">
                <span>Product</span><span>Low at or below</span><span>Use</span>
              </div>
              <div className="divide-y divide-fuel-line">
                {(gasStockConfig.products || []).map((product, index) => (
                  <div key={product.id} className="grid grid-cols-[minmax(0,1fr)_96px_52px] items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_120px_76px] sm:gap-3 sm:px-4">
                    <span className="min-w-0 truncate font-black text-slate-800" title={product.name}>{product.name}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="h-10 w-full rounded-md border border-fuel-line px-3 text-center font-black outline-none focus:border-fuel-green"
                      value={product.reorderLevel ?? 0}
                      onChange={(event) => setGasStockConfig({
                        ...gasStockConfig,
                        products: gasStockConfig.products.map((item, itemIndex) => itemIndex === index ? { ...item, reorderLevel: Math.max(0, Number(event.target.value || 0)) } : item)
                      })}
                    />
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-fuel-green"
                      checked={product.active !== false}
                      aria-label={`Use ${product.name}`}
                      onChange={(event) => setGasStockConfig({
                        ...gasStockConfig,
                        products: gasStockConfig.products.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item)
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 text-sm font-semibold text-blue-900">
              Staff can save a partial draft. The linked task moves to Doing, and it moves to Done only after every active product has been entered and submitted.
            </div>
            <button className={primaryButton} disabled={saving}><Save size={18} /> {saving ? "Saving..." : "Save Gas Task"}</button>
          </form>
        </Card>

        <Card className="p-0">
          <SectionHeader
            icon={<ShoppingCart size={20} />}
            title="Order Tasks"
            description="Enable or pause the weekly tasks created from your order plans."
          />
          <div className="space-y-3 px-5 pb-5">
            {orderSchedules.length ? orderSchedules.map((schedule) => (
              <div key={schedule.id} className="flex items-start justify-between gap-4 rounded-lg border border-fuel-line bg-white p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-fuel-ink">{schedule.supplier ? `${schedule.supplier} — ` : ""}{schedule.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${schedule.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {schedule.active ? "Enabled" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {(schedule.weekdays || []).length} day{(schedule.weekdays || []).length === 1 ? "" : "s"} each week
                    {schedule.assignedStaffName ? ` · ${schedule.assignedStaffName}` : " · Anyone"}
                  </p>
                </div>
                <label className={`relative mt-1 inline-flex shrink-0 items-center ${savingScheduleId === schedule.id ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={schedule.active}
                    disabled={savingScheduleId === schedule.id}
                    aria-label={`${schedule.active ? "Pause" : "Enable"} ${schedule.name} weekly order task`}
                    onChange={() => toggleOrderSchedule(schedule)}
                  />
                  <span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-fuel-green" />
                  <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </div>
            )) : (
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="font-black text-fuel-ink">No order plans created yet</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Create an order plan once, then its enable switch will appear here.</p>
              </div>
            )}
            <button type="button" className={softButton} onClick={() => goTo?.("tasks-plans")}>
              <ShoppingCart size={18} /> Open Order Plans
            </button>
          </div>
        </Card>
        </div>
      ) : null}

      {activeSection === "access" ? (
      <Card className="p-0">
        <SectionHeader
          icon={<KeyRound size={20} />}
          title="Login Access"
          description="Staff logins are created automatically when staff are added. Create extra admin users here."
        />

        <form className="grid gap-4 px-5 pb-5 md:grid-cols-[1fr_1fr_auto]" onSubmit={createAdmin}>
          <Field label="Username">
            <input className={inputClass} value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} placeholder="manager-name" required />
          </Field>
          <Field label="Temporary password">
            <input className={inputClass} type="password" autoComplete="new-password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Set a temporary password" required minLength={8} />
          </Field>
          <button className={`${primaryButton} self-end`}>Create Admin</button>
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
                Reset temp password
              </button>
              <button className={user.active ? "inline-flex min-h-11 items-center justify-center rounded-lg bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700" : primaryButton} onClick={() => toggleUser(user)}>
                {user.active ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      {activeSection === "activity" ? (
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
      ) : null}
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

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function formatTimeLabel(value) {
  const [hourValue, minute = "00"] = String(value || "").split(":");
  const hour = Number(hourValue);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return minute === "00" ? `${displayHour}${suffix}` : `${displayHour}.${minute}${suffix}`;
}
