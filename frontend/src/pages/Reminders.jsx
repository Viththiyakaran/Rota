import React from "react";
import { Bell, CheckCheck, Download, ExternalLink, MessageCircle } from "lucide-react";
import { api } from "../api.js";
import { googleCalendarUrl, phoneCalendarDataUrl, phoneCalendarFilename } from "../calendarLinks.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { formatDateLabel, formatReminder } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Reminders({ branding = {}, currentUser = null }) {
  const [reminders, setReminders] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([api.notifications(), api.reminders()])
      .then(([notificationRows, reminderRows]) => {
        setNotifications(notificationRows);
        setReminders(reminderRows);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black">Notifications</h2>
          <p className="font-bold text-slate-600">Rota changes and upcoming shift reminders</p>
        </div>
        {unreadCount > 0 && (
          <button className="inline-flex items-center justify-center gap-2 rounded-md bg-fuel-green px-4 py-3 font-black text-white" onClick={markRead}>
            <CheckCheck size={18} />
            Mark all read
          </button>
        )}
      </div>

      <Status loading={loading} error={error} empty={notifications.length === 0 && reminders.length === 0}>
        {notifications.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Rota notifications</h3>
              {unreadCount > 0 && <span className="rounded-full bg-fuel-lime px-3 py-1 text-sm font-black">{unreadCount} unread</span>}
            </div>
            {notifications.map((notification) => (
              <Card key={notification.id} className={notification.unread ? "border-fuel-green bg-fuel-mist" : ""}>
                <div className="flex gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-fuel-lime">
                    <Bell size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black">{displayNotificationTitle(notification, currentUser)}</p>
                    <p className="font-bold text-fuel-green">{displayNotificationMessage(notification, currentUser)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {notification.staffName} - {formatNotificationDate(notification.createdAt)}
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-fuel-lime">
                    <Bell size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black">{reminder.staffName}</p>
                    <p className="font-bold text-fuel-green">{displayReminderMessage(reminder, currentUser)}</p>
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
                        className="inline-flex items-center gap-2 rounded-md bg-fuel-green px-3 py-2 text-sm font-black text-white"
                        href={googleCalendarUrl(reminder, branding.appTitle)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={16} />
                        Google
                      </a>
                      <a
                        className="inline-flex items-center gap-2 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green"
                        href={phoneCalendarDataUrl(reminder, branding.appTitle)}
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
  if (currentUser?.role === "admin" && notification.type === "shift_reminder") {
    return `${notification.staffName || "Staff"} shift reminder`;
  }
  return notification.title;
}

function displayNotificationMessage(notification, currentUser) {
  if (currentUser?.role === "admin" && notification.type === "shift_reminder") {
    return staffMessage(notification.message, notification.staffName);
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

function formatNotificationDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}
