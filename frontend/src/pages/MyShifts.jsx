import React from "react";
import { CalendarDays, Clock, Download, ExternalLink, LocateFixed, MapPin } from "lucide-react";
import { api } from "../api.js";
import { googleCalendarUrl, phoneCalendarDataUrl, phoneCalendarFilename } from "../calendarLinks.js";
import { Card } from "../components/Card.jsx";
import { PageHeader, primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { formatDayLabel, formatShiftRange, toDateInputValue } from "../dateUtils.js";

export function MyShifts({ branding = {} }) {
  const [shifts, setShifts] = React.useState([]);
  const [attendance, setAttendance] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [attendanceError, setAttendanceError] = React.useState("");
  const [attendanceMessage, setAttendanceMessage] = React.useState("");
  const [clockLoading, setClockLoading] = React.useState(false);

  const loadPage = React.useCallback(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([api.myShifts(), api.attendanceStatus()])
      .then(([shiftResult, attendanceResult]) => {
        if (shiftResult.status === "fulfilled") setShifts(shiftResult.value);
        if (attendanceResult.status === "fulfilled") setAttendance(attendanceResult.value);
        const failed = [shiftResult, attendanceResult].find((result) => result.status === "rejected");
        if (failed) setError(failed.reason.message);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handleClock = async (mode) => {
    setClockLoading(true);
    setAttendanceError("");
    setAttendanceMessage("");
    try {
      const payload = await buildClockPayload(attendance?.locationRequired, shifts);
      const saved = mode === "in" ? await api.clockIn(payload) : await api.clockOut(payload);
      setAttendanceMessage(mode === "in" ? `Clocked in at ${formatClockTime(saved.clockInAt)}.` : `Clocked out at ${formatClockTime(saved.clockOutAt)}.`);
      setAttendance(await api.attendanceStatus());
    } catch (err) {
      setAttendanceError(err.message);
    } finally {
      setClockLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Staff"
        title="My Shifts"
        description="Your upcoming shifts, notes, and calendar shortcuts."
      />
      <AttendancePanel
        attendance={attendance}
        error={attendanceError}
        loading={clockLoading}
        message={attendanceMessage}
        onClockIn={() => handleClock("in")}
        onClockOut={() => handleClock("out")}
      />
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
                      className={primaryButton}
                      href={googleCalendarUrl(shift, branding.appTitle, branding.businessTimezone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} />
                      Google
                    </a>
                    <a
                      className={softButton}
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

function AttendancePanel({ attendance, error, loading, message, onClockIn, onClockOut }) {
  if (!attendance?.enabled) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
            <Clock size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black text-fuel-ink">Clock In / Out</h3>
            <p className="text-sm font-semibold text-slate-500">Clock-in is off. Admin can enable it in Settings.</p>
          </div>
        </div>
      </Card>
    );
  }

  const openEntry = attendance.openEntry;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
            {attendance.locationRequired ? <LocateFixed size={22} /> : <Clock size={22} />}
          </span>
          <div>
            <h3 className="text-lg font-black text-fuel-ink">Clock In / Out</h3>
            {openEntry ? (
              <p className="text-sm font-semibold text-slate-600">
                Clocked in at {formatClockTime(openEntry.clockInAt)}
                {openEntry.shiftDate ? ` for ${formatDayLabel(openEntry.shiftDate)}` : ""}.
              </p>
            ) : (
              <p className="text-sm font-semibold text-slate-600">Ready to clock in for your shift.</p>
            )}
            {attendance.locationRequired && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                <MapPin size={13} />
                Location is required only when you tap Clock In or Clock Out.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className={openEntry ? softButton : primaryButton}
          disabled={loading}
          onClick={openEntry ? onClockOut : onClockIn}
        >
          <Clock size={16} />
          {loading ? "Saving..." : openEntry ? "Clock Out" : "Clock In"}
        </button>
      </div>
      {message && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-fuel-green">{message}</p>}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
    </Card>
  );
}

async function buildClockPayload(locationRequired, shifts) {
  const shift = pickClockShift(shifts);
  const location = locationRequired ? await getBrowserLocation() : {};
  return {
    shiftId: shift?.id || null,
    ...location
  };
}

function pickClockShift(shifts) {
  const today = toDateInputValue(new Date());
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const todayShifts = shifts
    .filter((shift) => shift.shiftDate === today)
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  return todayShifts.find((shift) => isTimeInShift(currentMinutes, shift.startTime, shift.endTime)) || todayShifts[0] || null;
}

function getBrowserLocation() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("This browser does not support location permission."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      () => reject(new Error("Please allow location permission to clock in or out.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function formatClockTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function timeToMinutes(value) {
  const [hours = 0, minutes = 0] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function isTimeInShift(currentMinutes, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return currentMinutes >= start || currentMinutes < end;
  return currentMinutes >= start && currentMinutes < end;
}
