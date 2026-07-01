import React from "react";
import { CalendarDays, Download, ExternalLink } from "lucide-react";
import { api } from "../api.js";
import { googleCalendarUrl, phoneCalendarDataUrl, phoneCalendarFilename } from "../calendarLinks.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { formatDayLabel, formatShiftRange } from "../dateUtils.js";

export function MyShifts({ branding = {} }) {
  const [shifts, setShifts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api.myShifts()
      .then(setShifts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-black">My Shifts</h2>
      <Status loading={loading} error={error} empty={shifts.length === 0}>
        <div className="space-y-3">
          {shifts.map((shift) => (
            <Card key={shift.id}>
              <div className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-fuel-lime text-fuel-ink">
                  <CalendarDays size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black">{formatDayLabel(shift.shiftDate)}</p>
                  <p className="font-black text-fuel-green">{formatShiftRange(shift.startTime, shift.endTime)}</p>
                  <p className="text-sm font-bold text-slate-600">{shift.totalHours} hrs</p>
                  {shift.notes && <p className="mt-2 rounded-md bg-fuel-mist px-2 py-1 text-sm font-bold">{shift.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="inline-flex items-center gap-2 rounded-md bg-fuel-green px-3 py-2 text-sm font-black text-white"
                      href={googleCalendarUrl(shift, branding.appTitle, branding.businessTimezone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} />
                      Google
                    </a>
                    <a
                      className="inline-flex items-center gap-2 rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green"
                      href={phoneCalendarDataUrl(shift, branding.appTitle, branding.businessTimezone)}
                      download={phoneCalendarFilename(shift)}
                    >
                      <Download size={16} />
                      Phone calendar
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Status>
    </div>
  );
}
