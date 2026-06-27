import React from "react";
import { Bell, MessageCircle } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { formatReminder } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Reminders() {
  const [reminders, setReminders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api.reminders()
      .then(setReminders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-black">Upcoming Reminders</h2>
      <Status loading={loading} error={error} empty={reminders.length === 0}>
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <Card key={reminder.id}>
              <div className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-fuel-lime">
                  <Bell size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-black">{reminder.staffName}</p>
                  <p className="font-bold text-fuel-green">{reminder.reminderMessage}</p>
                  {reminder.isExtra && (
                    <p className="text-sm font-black text-fuel-ink">
                      Extra cover{reminder.coverForStaffName ? ` for ${reminder.coverForStaffName}` : ""}
                    </p>
                  )}
                  <p className="text-sm text-slate-600">Reminder: {formatReminder(reminder.reminderTime)}</p>
                  <p className="text-sm text-slate-600">Shift: {reminder.shiftDate}, {reminder.startTime} - {reminder.endTime}</p>
                  {whatsappReminderUrl(reminder) ? (
                    <a
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-black text-white"
                      href={whatsappReminderUrl(reminder)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={18} />
                      WhatsApp
                    </a>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-slate-500">No WhatsApp number</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Status>
    </div>
  );
}
