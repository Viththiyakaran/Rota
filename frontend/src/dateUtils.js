export function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonday(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatDayLabel(dateString) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(`${dateString}T00:00:00`));
}

export function formatReminder(isoString) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

export function formatShiftTime(time) {
  const [hourValue, minuteValue] = time.split(":").map(Number);
  const suffix = hourValue >= 12 ? "pm" : "am";
  const hour = hourValue % 12 || 12;
  const minute = minuteValue === 0 ? "" : `.${String(minuteValue).padStart(2, "0")}`;
  return `${hour}${minute}${suffix}`;
}

export function formatShiftRange(startTime, endTime) {
  return `${formatShiftTime(startTime)}-${formatShiftTime(endTime)}`;
}
