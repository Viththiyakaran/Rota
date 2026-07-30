import React from "react";
import {
  Bell,
  CalendarClock,
  CalendarOff,
  Check,
  CheckCheck,
  Clock3,
  Download,
  ExternalLink,
  Info,
  MessageCircle
} from "lucide-react";
import { api } from "../api.js";
import { googleCalendarUrl, phoneCalendarDataUrl, phoneCalendarFilename } from "../calendarLinks.js";
import { Card } from "../components/Card.jsx";
import { PageHeader, Pill, primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { formatDateLabel, formatReminder } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["shift", "Shifts"],
  ["time-off", "Time off"],
  ["system", "System"]
];

export function Reminders({ branding = {}, currentUser = null }) {
  const [reminders, setReminders] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [readingId, setReadingId] = React.useState(null);
  const [markingAll, setMarkingAll] = React.useState(false);
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

  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const filterCounts = {
    all: notifications.length,
    unread: unreadCount,
    shift: notifications.filter((notification) => notificationCategory(notification) === "shift").length,
    "time-off": notifications.filter((notification) => notificationCategory(notification) === "time-off").length,
    system: notifications.filter((notification) => notificationCategory(notification) === "system").length
  };
  const filteredNotifications = notifications.filter((notification) => (
    filter === "all" ||
    (filter === "unread" && notification.unread) ||
    notificationCategory(notification) === filter
  ));
  const newNotifications = filteredNotifications.filter((notification) => notification.unread);
  const earlierNotifications = filteredNotifications.filter((notification) => !notification.unread);

  const markAllRead = async () => {
    setMarkingAll(true);
    setError("");
    try {
      await api.readNotifications();
      setNotifications((rows) => rows.map((notification) => ({
        ...notification,
        unread: false,
        readAt: notification.readAt || new Date().toISOString()
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const markOneRead = async (id) => {
    setReadingId(id);
    setError("");
    try {
      await api.readNotification(id);
      setNotifications((rows) => rows.map((notification) => (
        notification.id === id
          ? { ...notification, unread: false, readAt: notification.readAt || new Date().toISOString() }
          : notification
      )));
    } catch (err) {
      setError(err.message);
    } finally {
      setReadingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        description="See what changed, what needs attention, and which shifts are coming up."
        meta={unreadCount > 0 ? <Pill tone="lime">{unreadCount} new</Pill> : <Pill>All caught up</Pill>}
        action={unreadCount > 0 && (
          <button className={primaryButton} onClick={markAllRead} disabled={markingAll}>
            <CheckCheck size={18} />
            {markingAll ? "Updating..." : "Mark all read"}
          </button>
        )}
      />

      {error && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      <Status
        loading={loading}
        empty={notifications.length === 0 && reminders.length === 0 && !notificationError && !reminderError}
      >
        <section className="grid grid-cols-3 gap-3">
          <SummaryCard icon={Bell} label="Unread" value={unreadCount} tone="blue" />
          <SummaryCard icon={CalendarClock} label="Upcoming shifts" value={reminders.length} tone="green" />
          <SummaryCard icon={CheckCheck} label="Read" value={notifications.length - unreadCount} tone="slate" />
        </section>

        <Card className="p-2">
          <div className="flex gap-1 overflow-x-auto" aria-label="Notification filters">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  filter === id ? "bg-fuel-green text-white shadow-sm" : "text-slate-600 hover:bg-fuel-mist hover:text-fuel-green"
                }`}
                aria-pressed={filter === id}
              >
                {label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                  filter === id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {filterCounts[id]}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {(notificationError || reminderError) && (
          <div className="space-y-2">
            {notificationError && <Warning text={`Notifications could not load: ${notificationError}`} />}
            {reminderError && <Warning text={`Upcoming shifts could not load: ${reminderError}`} />}
          </div>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.85fr)]">
          <section className="space-y-4">
            {filteredNotifications.length === 0 ? (
              <Card className="py-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fuel-mist text-fuel-green">
                  <CheckCheck size={22} />
                </span>
                <h3 className="mt-3 font-black text-fuel-ink">Nothing in this filter</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">You are up to date here.</p>
              </Card>
            ) : (
              <>
                {newNotifications.length > 0 && (
                  <NotificationGroup
                    title="New"
                    count={newNotifications.length}
                    notifications={newNotifications}
                    currentUser={currentUser}
                    readingId={readingId}
                    onRead={markOneRead}
                  />
                )}
                {earlierNotifications.length > 0 && (
                  <NotificationGroup
                    title={newNotifications.length > 0 ? "Earlier" : "Notifications"}
                    count={earlierNotifications.length}
                    notifications={earlierNotifications}
                    currentUser={currentUser}
                    readingId={readingId}
                    onRead={markOneRead}
                  />
                )}
              </>
            )}
          </section>

          <UpcomingReminders
            branding={branding}
            currentUser={currentUser}
            reminders={reminders}
          />
        </div>
      </Status>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, tone, value }) {
  const tones = {
    blue: "bg-fuel-mist text-fuel-green",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600"
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

function NotificationGroup({ count, currentUser, notifications, onRead, readingId, title }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-lg font-black text-fuel-ink">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{count}</span>
      </div>
      <Card className="divide-y divide-fuel-line overflow-hidden p-0">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            currentUser={currentUser}
            onRead={() => onRead(notification.id)}
            reading={readingId === notification.id}
          />
        ))}
      </Card>
    </div>
  );
}

function NotificationItem({ currentUser, notification, onRead, reading }) {
  const type = notificationType(notification);
  const Icon = type.icon;
  return (
    <article className={`relative flex gap-3 px-4 py-4 ${notification.unread ? "bg-blue-50/55" : "bg-white"}`}>
      {notification.unread && <span className="absolute left-0 top-0 h-full w-1 bg-fuel-green" />}
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${type.tone}`}>
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-fuel-ink">{displayNotificationTitle(notification, currentUser)}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                {type.label}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{displayNotificationMessage(notification, currentUser)}</p>
            <p className="mt-1.5 text-xs font-semibold text-slate-500">{notificationMeta(notification)}</p>
          </div>
          {notification.unread && (
            <button
              type="button"
              onClick={onRead}
              disabled={reading}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3 text-xs font-black text-fuel-green ring-1 ring-fuel-line hover:bg-fuel-mist disabled:opacity-60"
            >
              <Check size={15} />
              {reading ? "Updating..." : "Mark read"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function UpcomingReminders({ branding, currentUser, reminders }) {
  return (
    <section className="overflow-hidden rounded-xl border border-fuel-line bg-white shadow-soft xl:sticky xl:top-20">
      <div className="flex items-center justify-between gap-3 border-b border-fuel-line px-4 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-fuel-green">Next up</p>
          <h2 className="mt-1 text-lg font-black text-fuel-ink">Upcoming shifts</h2>
        </div>
        <Pill>{reminders.length}</Pill>
      </div>
      <div className="max-h-[640px] divide-y divide-fuel-line overflow-y-auto">
        {reminders.length > 0 ? reminders.map((reminder) => (
          <article key={reminder.id} className="p-4">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Clock3 size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-fuel-ink">{reminder.staffName}</h3>
                  <span className="shrink-0 text-xs font-black text-fuel-green">{reminder.startTime}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-700">{displayReminderMessage(reminder, currentUser)}</p>
                {reminder.isExtra && (
                  <p className="mt-1 text-xs font-black text-amber-700">
                    Extra cover{reminder.coverForStaffName ? ` for ${reminder.coverForStaffName}` : ""}
                  </p>
                )}
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {formatDateLabel(reminder.shiftDate)} · {reminder.startTime}–{reminder.endTime}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Reminder {formatReminder(reminder.reminderTime)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {whatsappReminderUrl(reminder) && (
                    <a
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-xs font-black text-white"
                      href={whatsappReminderUrl(reminder)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={15} />
                      WhatsApp
                    </a>
                  )}
                  <a
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-fuel-mist px-3 text-xs font-black text-fuel-green"
                    href={googleCalendarUrl(reminder, branding.appTitle, branding.businessTimezone)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={15} />
                    Google
                  </a>
                  <a
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600"
                    href={phoneCalendarDataUrl(reminder, branding.appTitle, branding.businessTimezone)}
                    download={phoneCalendarFilename(reminder)}
                  >
                    <Download size={15} />
                    Phone
                  </a>
                </div>
              </div>
            </div>
          </article>
        )) : (
          <div className="p-6 text-center">
            <CheckCheck className="mx-auto text-emerald-600" size={24} />
            <p className="mt-2 text-sm font-bold text-slate-500">No upcoming shifts.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Warning({ text }) {
  return (
    <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
      {text}
    </p>
  );
}

function notificationType(notification) {
  const category = notificationCategory(notification);
  if (category === "shift") return { icon: CalendarClock, label: "Shift", tone: "bg-blue-100 text-blue-700" };
  if (category === "time-off") return { icon: CalendarOff, label: "Time off", tone: "bg-amber-100 text-amber-700" };
  return { icon: Info, label: "System", tone: "bg-slate-100 text-slate-600" };
}

function notificationCategory(notification) {
  if (isShiftNotification(notification.type) || /shift/i.test(notification.title || "")) return "shift";
  if (/time.?off|holiday|unavailable/i.test(`${notification.type} ${notification.title} ${notification.message}`)) return "time-off";
  return "system";
}

function displayNotificationTitle(notification, currentUser) {
  if (currentUser?.role === "admin" && isShiftNotification(notification.type)) {
    if (notification.type === "shift_start") return `${notification.staffName || "Staff"} shift starting now`;
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
  if (currentUser?.role === "admin") return staffMessage(reminder.reminderMessage, reminder.staffName);
  return reminder.reminderMessage;
}

function staffMessage(message, staffName = "Staff") {
  return String(message || "").replace(/^Your shift starts/i, `${staffName}'s shift starts`);
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
    .join(" · ");
}

function formatNotificationDate(value) {
  if (!value) return "";
  const date = parseNotificationDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const dayKey = (item) => `${item.getFullYear()}-${item.getMonth()}-${item.getDate()}`;
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  if (dayKey(date) === dayKey(today)) return `Today, ${time}`;
  if (dayKey(date) === dayKey(yesterday)) return `Yesterday, ${time}`;
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
