import React from "react";
import { Bell, CheckCheck, Download, ExternalLink, MessageCircle, MoreHorizontal } from "lucide-react";
import { api } from "../api.js";
import { googleCalendarUrl, phoneCalendarDataUrl, phoneCalendarFilename } from "../calendarLinks.js";
import { primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { formatDateLabel, formatReminder } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Reminders({ branding = {}, currentUser = null }) {
  const [reminders, setReminders] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [tab, setTab] = React.useState("all");
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
  const visibleNotifications = tab === "unread"
    ? notifications.filter((notification) => notification.unread)
    : notifications;
  const todayNotifications = visibleNotifications.filter((notification) => isToday(notification.createdAt));
  const earlierNotifications = visibleNotifications.filter((notification) => !isToday(notification.createdAt));

  return (
    <div className="mx-auto max-w-3xl">
      <Status loading={loading} error={error} empty={notifications.length === 0 && reminders.length === 0}>
        <section className="overflow-hidden rounded-xl border border-fuel-line bg-white shadow-sm">
          <div className="border-b border-fuel-line px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-fuel-ink sm:text-3xl">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button className="hidden items-center gap-2 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green sm:inline-flex" onClick={markRead}>
                    <CheckCheck size={16} />
                    Mark read
                  </button>
                )}
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600" title="Notification options">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm font-black ${tab === "all" ? "bg-fuel-mist text-fuel-green" : "text-fuel-ink hover:bg-slate-100"}`}
                onClick={() => setTab("all")}
              >
                All
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-black ${tab === "unread" ? "bg-fuel-mist text-fuel-green" : "text-fuel-ink hover:bg-slate-100"}`}
                onClick={() => setTab("unread")}
              >
                Unread
              </button>
              {unreadCount > 0 && <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">{unreadCount}</span>}
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4">
            {visibleNotifications.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">No {tab === "unread" ? "unread " : ""}notifications.</p>
            ) : (
              <>
                <NotificationGroup title="Today" rows={todayNotifications} currentUser={currentUser} />
                <NotificationGroup title="Earlier" rows={earlierNotifications} currentUser={currentUser} />
              </>
            )}

            <div className="mt-5">
              <h3 className="px-2 text-lg font-black text-fuel-ink">Upcoming shift reminders</h3>
              <div className="mt-2 divide-y divide-fuel-line overflow-hidden rounded-lg border border-fuel-line bg-white">
                {reminders.map((reminder) => (
                  <ReminderRow key={reminder.id} reminder={reminder} branding={branding} currentUser={currentUser} />
                ))}
                {reminders.length === 0 && <p className="p-4 text-sm font-bold text-slate-500">No upcoming reminders.</p>}
              </div>
            </div>
          </div>
        </section>
      </Status>
    </div>
  );
}

function NotificationGroup({ title, rows, currentUser }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-4">
      <h3 className="px-2 pb-2 text-lg font-black text-fuel-ink">{title}</h3>
      <div className="divide-y divide-fuel-line overflow-hidden rounded-lg border border-fuel-line bg-white">
        {rows.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} currentUser={currentUser} />
        ))}
      </div>
    </div>
  );
}

function NotificationRow({ notification, currentUser }) {
  return (
    <article className={`relative flex gap-3 px-3 py-3 transition hover:bg-fuel-mist/70 ${notification.unread ? "bg-blue-50/50" : "bg-white"}`}>
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fuel-mist text-fuel-green">
        <Bell size={22} />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Bell size={12} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-slate-700">
          <span className="font-black text-fuel-ink">{displayNotificationTitle(notification, currentUser)}</span>{" "}
          {displayNotificationMessage(notification, currentUser)}
        </p>
        <p className={`mt-1 text-xs font-black ${notification.unread ? "text-blue-600" : "text-slate-500"}`}>
          {notification.staffName ? `${notification.staffName} - ` : ""}{formatNotificationDate(notification.createdAt)}
        </p>
      </div>
      {notification.unread && <span className="mt-5 h-3 w-3 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
    </article>
  );
}

function ReminderRow({ reminder, branding, currentUser }) {
  return (
    <article className="flex gap-3 px-3 py-3 transition hover:bg-fuel-mist/70">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fuel-lime text-fuel-ink">
        <Bell size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-fuel-ink">{reminder.staffName}</p>
        <p className="text-sm font-bold text-fuel-green">{displayReminderMessage(reminder, currentUser)}</p>
        {reminder.isExtra && (
          <p className="text-sm font-black text-fuel-ink">
            Extra cover{reminder.coverForStaffName ? ` for ${reminder.coverForStaffName}` : ""}
          </p>
        )}
        <p className="mt-1 text-xs font-bold text-slate-600">Reminder: {formatReminder(reminder.reminderTime)}</p>
        <p className="text-xs font-bold text-slate-600">Shift: {formatDateLabel(reminder.shiftDate)}, {reminder.startTime} - {reminder.endTime}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsappReminderUrl(reminder) ? (
            <a
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-black text-white"
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
    </article>
  );
}

function displayNotificationTitle(notification, currentUser) {
  if (currentUser?.role === "admin" && isStaffShiftReminder(notification.type)) {
    if (notification.type === "shift_start") {
      return `${notification.staffName || "Staff"} shift starting now`;
    }
    return `${notification.staffName || "Staff"} shift reminder`;
  }
  return notification.title;
}

function displayNotificationMessage(notification, currentUser) {
  if (currentUser?.role === "admin" && isStaffShiftReminder(notification.type)) {
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

function isStaffShiftReminder(type) {
  return type === "shift_reminder" || type === "shift_start";
}

function isToday(value) {
  const date = parseNotificationDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

function formatNotificationDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parseNotificationDate(value));
}

function parseNotificationDate(value) {
  if (!value) return null;
  return new Date(`${String(value).replace(" ", "T")}Z`);
}
