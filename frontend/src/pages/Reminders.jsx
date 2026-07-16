import React from "react";
import { Bell, CheckCheck, Download, ExternalLink, MessageCircle } from "lucide-react";
import { api } from "../api.js";
import { googleCalendarUrl, phoneCalendarDataUrl, phoneCalendarFilename } from "../calendarLinks.js";
import { Card } from "../components/Card.jsx";
import { PageHeader, Pill, primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { formatDateLabel, formatReminder } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Reminders({ branding = {}, currentUser = null }) {
  const [reminders, setReminders] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notificationError, setNotificationError] = React.useState("");
  const [reminderError, setReminderError] = React.useState("");
  const [filter, setFilter] = React.useState("all");

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    setNotificationError("");
    setReminderError("");
    Promise.allSettled([api.notifications(), api.reminders()])
      .then(([notificationResult, reminderResult]) => {
        if (notificationResult.status === "fulfilled") {
          setNotifications(notificationResult.value);
        } else {
          setNotifications([]);
          setNotificationError(notificationResult.reason?.message || "Notifications could not load.");
        }

        if (reminderResult.status === "fulfilled") {
          setReminders(reminderResult.value);
        } else {
          setReminders([]);
          setReminderError(reminderResult.reason?.message || "Shift reminders could not load.");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const markRead = async () => {
    await api.readNotifications();
    load();
  };

  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "all") return true;
    if (filter === "unread") return notification.unread;
    if (filter === "shift") return isStaffShiftReminder(notification.type) || /shift/i.test(notification.title || "");
    if (filter === "time-off") return /time.?off|holiday|unavailable/i.test(`${notification.type} ${notification.title} ${notification.message}`);
    if (filter === "system") return !isStaffShiftReminder(notification.type) && !/time.?off|holiday|unavailable/i.test(`${notification.type} ${notification.title} ${notification.message}`);
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        description="Rota changes and upcoming shift reminders."
        meta={unreadCount > 0 ? <Pill tone="lime">{unreadCount} unread</Pill> : <Pill>All read</Pill>}
        action={unreadCount > 0 && (
          <button className={primaryButton} onClick={markRead}>
            <CheckCheck size={18} />
            Mark all read
          </button>
        )}
      />

      <Status
        loading={loading}
        error={error}
        empty={notifications.length === 0 && reminders.length === 0 && !notificationError && !reminderError}
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ["all", "All"],
            ["unread", "Unread"],
            ["shift", "Shift"],
            ["time-off", "Time Off"],
            ["system", "System"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                filter === id ? "bg-fuel-green text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-fuel-line hover:bg-fuel-mist hover:text-fuel-green"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(notificationError || reminderError) && (
          <div className="space-y-2">
            {notificationError && (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                Rota notifications could not load: {notificationError}
              </p>
            )}
            {reminderError && (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                Upcoming shift reminders could not load: {reminderError}
              </p>
            )}
          </div>
        )}

        {notifications.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Rota notifications</h3>
              {unreadCount > 0 && <span className="rounded-full bg-fuel-lime px-3 py-1 text-sm font-black">{unreadCount} unread</span>}
            </div>
            {filteredNotifications.length === 0 ? (
              <Card className="text-sm font-semibold text-slate-500">No notifications in this filter.</Card>
            ) : filteredNotifications.map((notification) => (
              <Card key={notification.id} className={notification.unread ? "border-fuel-green bg-fuel-mist" : ""}>
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuel-lime">
                    <Bell size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-extrabold">{displayNotificationTitle(notification, currentUser)}</p>
                      {notification.unread && <Pill tone="lime">Unread</Pill>}
                    </div>
                    <p className="mt-1 font-semibold text-fuel-green">{displayNotificationMessage(notification, currentUser)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {notificationMeta(notification)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-xl font-black">Upcoming shift reminders</h3>
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <Card key={reminder.id}>
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuel-lime">
                    <Bell size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold">{reminder.staffName}</p>
                    <p className="font-semibold text-fuel-green">{displayReminderMessage(reminder, currentUser)}</p>
                    {reminder.isExtra && (
                      <p className="text-sm font-black text-fuel-ink">
                        Extra cover{reminder.coverForStaffName ? ` for ${reminder.coverForStaffName}` : ""}
                      </p>
                    )}
                    <p className="text-sm text-slate-600">Reminder: {formatReminder(reminder.reminderTime)}</p>
                    <p className="text-sm text-slate-600">Shift: {formatDateLabel(reminder.shiftDate)}, {reminder.startTime} - {reminder.endTime}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {whatsappReminderUrl(reminder) ? (
                        <a
                          className="inline-flex items-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-black text-white"
                          href={whatsappReminderUrl(reminder)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={16} />
                          WhatsApp
                        </a>
                      ) : null}
                      <a
                      className={primaryButton}
                        href={googleCalendarUrl(reminder, branding.appTitle, branding.businessTimezone)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={16} />
                        Google
                      </a>
                      <a
                        className={softButton}
                        href={phoneCalendarDataUrl(reminder, branding.appTitle, branding.businessTimezone)}
                        download={phoneCalendarFilename(reminder)}
                      >
                        <Download size={16} />
                        Phone
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </Status>
    </div>
  );
}

function displayNotificationTitle(notification, currentUser) {
  if (currentUser?.role === "admin" && isShiftNotification(notification.type)) {
    if (notification.type === "shift_start") {
      return `${notification.staffName || "Staff"} shift starting now`;
    }
    return `${notification.staffName || "Staff"} shift reminder`;
  }
  return notification.title;
}

function displayNotificationMessage(notification, currentUser) {
  if (currentUser?.role === "admin" && isShiftNotification(notification.type)) {
    return adminStaffMessage(notification.message, notification.staffName);
  }
  return notification.message;
}

function displayReminderMessage(reminder, currentUser) {
  if (currentUser?.role === "admin") {
    return staffMessage(reminder.reminderMessage, reminder.staffName);
  }
  return reminder.reminderMessage;
}

function staffMessage(message, staffName = "Staff") {
  return String(message || "").replace(/^Your shift starts/i, `${staffName}'s shift starts`);
}

function isStaffShiftReminder(type) {
  return type === "shift_reminder" || type === "shift_start";
}

function isShiftNotification(type) {
  return [
    "shift_created",
    "shift_deleted",
    "shift_note",
    "shift_reassigned",
    "shift_reminder",
    "shift_start",
    "shift_updated"
  ].includes(type);
}

function adminStaffMessage(message, staffName = "Staff") {
  return String(message || "")
    .replace(/^You have a shift/i, `${staffName} has a shift`)
    .replace(/^Your shift starts/i, `${staffName}'s shift starts`)
    .replace(/^Your shift on/i, `${staffName}'s shift on`);
}

function notificationMeta(notification) {
  return [notification.staffName, formatNotificationDate(notification.createdAt)]
    .filter(Boolean)
    .join(" - ");
}

function formatNotificationDate(value) {
  if (!value) return "";
  const date = parseNotificationDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function parseNotificationDate(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").trim();
  if (!text) return new Date("");
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) return new Date(text);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date(`${text.replace(" ", "T")}Z`);
}
