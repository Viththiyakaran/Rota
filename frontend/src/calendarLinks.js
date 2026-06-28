import { formatDateLabel, formatShiftRange } from "./dateUtils.js";

export function googleCalendarUrl(shift, businessName = "Rota") {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: shiftTitle(shift, businessName),
    dates: `${googleDateTime(shift.shiftDate, shift.startTime)}/${googleDateTime(endDateForShift(shift), shift.endTime)}`,
    details: shiftDescription(shift),
    ctz: "Europe/London"
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function phoneCalendarDataUrl(shift, businessName = "Rota") {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FuelOps Rota//Shift//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:fuelops-shift-${shift.id}@fuelops-rota`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART;TZID=Europe/London:${localIcsDateTime(shift.shiftDate, shift.startTime)}`,
    `DTEND;TZID=Europe/London:${localIcsDateTime(endDateForShift(shift), shift.endTime)}`,
    `SUMMARY:${escapeIcs(shiftTitle(shift, businessName))}`,
    `DESCRIPTION:${escapeIcs(shiftDescription(shift))}`,
    "BEGIN:VALARM",
    `TRIGGER:-PT${Math.max(Number(shift.reminderMinutes || 60), 0)}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(shift.reminderMessage || "Your shift starts soon")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(`${ics}\r\n`)}`;
}

export function phoneCalendarFilename(shift) {
  return `shift-${shift.shiftDate}-${String(shift.startTime || "").replace(":", "")}.ics`;
}

function shiftTitle(shift, businessName) {
  return `${businessName} shift - ${shift.staffName || "Staff"}`;
}

function shiftDescription(shift) {
  return [
    `Shift: ${formatDateLabel(shift.shiftDate)}, ${formatShiftRange(shift.startTime, shift.endTime)}`,
    shift.isExtra && shift.coverForStaffName ? `Extra cover for ${shift.coverForStaffName}` : "",
    shift.notes ? `Note: ${shift.notes}` : ""
  ].filter(Boolean).join("\n");
}

function endDateForShift(shift) {
  if (shift.endTime > shift.startTime) return shift.shiftDate;
  const date = new Date(`${shift.shiftDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function googleDateTime(date, time) {
  return `${date.replaceAll("-", "")}T${String(time || "00:00").replace(":", "")}00`;
}

function localIcsDateTime(date, time) {
  return `${date.replaceAll("-", "")}T${String(time || "00:00").replace(":", "")}00`;
}

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
