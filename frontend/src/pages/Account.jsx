import React from "react";
import { Bell, CalendarDays, Copy, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, primaryButton, softButton } from "../components/PageHeader.jsx";
import { canUsePushNotifications, enablePushNotifications } from "../pushNotifications.js";

export function Account({ currentUser, forced = false, onPasswordChanged = () => {} }) {
  const [form, setForm] = React.useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [pushStatus, setPushStatus] = React.useState({ available: false, enabled: false, subscriptions: 0 });
  const [pushMessage, setPushMessage] = React.useState("");
  const [pushError, setPushError] = React.useState("");
  const [savingPush, setSavingPush] = React.useState(false);
  const [calendarFeed, setCalendarFeed] = React.useState(null);
  const [calendarMessage, setCalendarMessage] = React.useState("");
  const [showPasswords, setShowPasswords] = React.useState(false);

  React.useEffect(() => {
    if (!currentUser.staffId) return;
    if (!canUsePushNotifications()) return;
    api.pushStatus()
      .then(setPushStatus)
      .catch(() => {});
  }, [currentUser.staffId]);

  React.useEffect(() => {
    if (!currentUser.staffId || forced) return;
    api.calendarFeed()
      .then(setCalendarFeed)
      .catch(() => {});
  }, [currentUser.staffId, forced]);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    try {
      const result = await api.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password changed.");
      if (result.user) onPasswordChanged(result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const enablePush = async () => {
    setSavingPush(true);
    setPushMessage("");
    setPushError("");
    try {
      await enablePushNotifications();
      const status = await api.pushStatus();
      setPushStatus(status);
      setPushMessage("Notifications enabled on this device.");
    } catch (err) {
      setPushError(err.message);
    } finally {
      setSavingPush(false);
    }
  };

  const copyCalendarFeed = async () => {
    if (!calendarFeed?.feedUrl) return;
    try {
      await navigator.clipboard.writeText(calendarFeed.feedUrl);
      setCalendarMessage("Calendar feed link copied.");
    } catch (_error) {
      setCalendarMessage("Copy blocked by browser. Long-press the link above to copy it.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={currentUser.role}
        title="My Account"
        description={forced ? "Please change your temporary password before using the rota." : "Manage your password, phone notifications, and calendar sync."}
      />
      <Card className="mx-auto max-w-2xl">
        <form className="space-y-4" onSubmit={submit}>
          {message && <p className="rounded-md bg-fuel-mist p-3 font-bold text-fuel-green">{message}</p>}
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold">Password</h3>
              <p className="text-sm text-slate-500">Use a strong password before real staff use.</p>
            </div>
            <button
              type="button"
              className={softButton}
              onClick={() => setShowPasswords((value) => !value)}
            >
              {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
              {showPasswords ? "Hide" : "Show"}
            </button>
          </div>
          <Field label="Current password">
            <input className={inputClass} type={showPasswords ? "text" : "password"} autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password">
            <input className={inputClass} type={showPasswords ? "text" : "password"} autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <input className={inputClass} type={showPasswords ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </Field>
          <button className={`${primaryButton} w-full`}>
            <KeyRound size={18} />
            Change Password
          </button>
        </form>
      </Card>
      {!forced && currentUser.staffId && (
        <>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black">Phone Notifications</h3>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  Get shift reminders even when this app is closed.
                </p>
                {pushStatus.enabled && (
                  <p className="mt-2 text-sm font-black text-fuel-green">
                    Enabled on {pushStatus.subscriptions} device{pushStatus.subscriptions === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
              <button
                className={`${primaryButton} disabled:bg-slate-300`}
                disabled={savingPush || !canUsePushNotifications()}
                onClick={enablePush}
              >
                <Bell size={18} />
                {savingPush ? "Enabling..." : "Enable Notifications"}
              </button>
            </div>
            {!canUsePushNotifications() && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">
                This browser does not support push notifications. On iPhone, install the app to the home screen first.
              </p>
            )}
            {pushMessage && <p className="mt-3 rounded-md bg-fuel-mist p-3 font-bold text-fuel-green">{pushMessage}</p>}
            {pushError && <p className="mt-3 rounded-md bg-red-50 p-3 font-bold text-red-700">{pushError}</p>}
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-xl font-black">Calendar Sync</h3>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  Subscribe from Apple Calendar, Google Calendar, Outlook, or your phone calendar.
                </p>
                {calendarFeed?.feedUrl && (
                  <p className="mt-2 truncate rounded-md bg-fuel-mist px-3 py-2 text-sm font-bold text-slate-700">
                    {calendarFeed.feedUrl}
                  </p>
                )}
              </div>
              {calendarFeed?.feedUrl && (
                <div className="flex flex-wrap gap-2">
                  <a
                    className={primaryButton}
                    href={calendarFeed.appleCalendarUrl || calendarFeed.feedUrl}
                  >
                    <CalendarDays size={18} />
                    Phone sync
                  </a>
                  <button
                    className={softButton}
                    onClick={copyCalendarFeed}
                  >
                    <Copy size={18} />
                    Copy link
                  </button>
                  <a
                    className={softButton}
                    href={calendarFeed.feedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={18} />
                    Open
                  </a>
                </div>
              )}
            </div>
            {calendarMessage && <p className="mt-3 rounded-md bg-fuel-mist p-3 font-bold text-fuel-green">{calendarMessage}</p>}
            <p className="mt-3 text-sm font-bold text-slate-500">
              Keep this link private. It lets a calendar app read your upcoming shifts.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
