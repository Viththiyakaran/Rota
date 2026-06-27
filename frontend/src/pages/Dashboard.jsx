import React from "react";
import { CalendarDays, MessageCircle, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";
import { whatsappReminderUrl } from "../whatsapp.js";

export function Dashboard({ goTo }) {
  const [staff, setStaff] = React.useState([]);
  const [shifts, setShifts] = React.useState([]);
  const [reminders, setReminders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    Promise.all([
      api.staff(),
      api.week(toDateInputValue(getMonday())),
      api.reminders()
    ])
      .then(([staffRows, shiftRows, reminderRows]) => {
        setStaff(staffRows);
        setShifts(shiftRows);
        setReminders(reminderRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeStaff = staff.filter((person) => person.active).length;
  const weekStart = getMonday();
  const weekDays = Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(weekStart, index)));

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-fuel-line bg-white p-5 shadow-soft">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-fuel-green">Today</p>
        <h2 className="mt-1 text-3xl font-black text-fuel-ink">FuelOps Rota</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
          Weekly rota, cover shifts, and reminders in one place.
        </p>
      </div>

      <Status loading={loading} error={error}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric icon={Users} label="Active staff" value={activeStaff} />
          <Metric icon={CalendarDays} label="Shifts this week" value={shifts.length} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <button onClick={() => goTo("add-staff")} className="rounded-md bg-fuel-green px-5 py-4 font-black text-white shadow-lift transition hover:bg-fuel-deep">
            Add Staff
          </button>
          <button onClick={() => goTo("add-shift")} className="rounded-md bg-fuel-ink px-5 py-4 font-black text-white shadow-soft transition hover:bg-fuel-deep">
            Add Shift
          </button>
          <button onClick={() => goTo("rota")} className="rounded-md bg-fuel-lime px-5 py-4 font-black text-fuel-ink shadow-soft transition hover:bg-fuel-gold">
            Weekly Rota
          </button>
        </div>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-black">Rota calendar</h3>
            <button className="text-sm font-bold text-fuel-green" onClick={() => goTo("rota")}>
              Open week
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Days</th>
                  {staff.filter((person) => person.active).map((person) => (
                    <th key={person.id} className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">
                      {person.name}
                    </th>
                  ))}
                  <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Notes</th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map((day) => {
                  const dayShifts = shifts.filter((shift) => shift.shiftDate === day);
                  const dayNotes = [...new Set(dayShifts.map((shift) => shift.notes).filter(Boolean))];
                  return (
                    <tr key={day}>
                      <td className="border border-fuel-line px-3 py-3 font-bold">{formatWeekday(day)}</td>
                      {staff.filter((person) => person.active).map((person) => {
                        const personShifts = dayShifts.filter((shift) => shift.staffId === person.id);
                        return (
                          <td key={person.id} className="border border-fuel-line px-3 py-3">
                            {personShifts.length > 0 ? (
                              <div className="space-y-1">
                                {personShifts.map((personShift) => (
                                  <div key={personShift.id} className="space-y-1">
                                    <p className="font-bold text-fuel-green">
                                      {formatShiftRange(personShift.startTime, personShift.endTime)}
                                    </p>
                                    {personShift.isExtra && (
                                      <p className="rounded-md bg-fuel-lime px-2 py-1 text-xs font-black text-fuel-ink">
                                        Extra cover{personShift.coverForStaffName ? ` for ${personShift.coverForStaffName}` : ""}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">Off</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-fuel-line px-3 py-3 font-bold">{dayNotes.join(", ")}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="border border-fuel-line bg-fuel-mist px-3 py-3 font-black">Total Hours</td>
                  {staff.filter((person) => person.active).map((person) => {
                    const total = shifts
                      .filter((shift) => shift.staffId === person.id)
                      .reduce((sum, shift) => sum + shift.paidHours, 0);
                    return (
                      <td key={person.id} className="border border-fuel-line bg-fuel-mist px-3 py-3 font-black">
                        {Number.isInteger(total) ? total : total.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="border border-fuel-line bg-fuel-mist px-3 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black">Upcoming reminders</h3>
            <button className="text-sm font-bold text-fuel-green" onClick={() => goTo("reminders")}>
              View all
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reminders.slice(0, 4).map((reminder) => (
              <div key={reminder.id} className="rounded-md bg-fuel-mist p-3">
                <p className="truncate font-black">{reminder.staffName}</p>
                <p className="mt-1 text-sm text-slate-700">{reminder.reminderMessage}</p>
                {reminder.isExtra && (
                  <p className="mt-1 text-xs font-black text-fuel-green">
                    Extra cover{reminder.coverForStaffName ? ` for ${reminder.coverForStaffName}` : ""}
                  </p>
                )}
                {whatsappReminderUrl(reminder) && (
                  <a
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-black text-white"
                    href={whatsappReminderUrl(reminder)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      </Status>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-600">{label}</p>
          <p className="mt-2 text-4xl font-black text-fuel-ink">{value}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-fuel-mist text-fuel-green">
          <Icon size={26} />
        </span>
      </div>
    </Card>
  );
}

function formatWeekday(dateString) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${dateString}T00:00:00`));
}
