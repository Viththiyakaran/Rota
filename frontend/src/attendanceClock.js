import { toDateInputValue } from "./dateUtils.js";

export async function buildClockPayload(locationRequired, shifts) {
  const shift = pickClockShift(shifts);
  const location = locationRequired ? await getBrowserLocation() : {};
  return {
    shiftId: shift?.id || null,
    ...location
  };
}

export function pickClockShift(shifts, now = new Date()) {
  const today = toDateInputValue(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayShifts = shifts
    .filter((shift) => shift.shiftDate === today)
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  return todayShifts.find((shift) => isTimeInShift(currentMinutes, shift.startTime, shift.endTime)) || todayShifts[0] || null;
}

export function findClockPromptShift(shifts, now = new Date()) {
  const today = toDateInputValue(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayShifts = shifts
    .filter((shift) => shift.shiftDate === today)
    .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));

  return todayShifts.find((shift) => {
    const start = timeToMinutes(shift.startTime);
    const end = timeToMinutes(shift.endTime);
    const promptStart = start - 15;
    if (end <= start) return currentMinutes >= promptStart || currentMinutes < end;
    return currentMinutes >= promptStart && currentMinutes < end;
  }) || null;
}

export function shouldPromptClockOut(openEntry, now = new Date()) {
  if (!openEntry) return false;
  if (!openEntry.shiftDate || !openEntry.endTime) return true;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = toDateInputValue(now);
  if (openEntry.shiftDate < today) return true;
  if (openEntry.shiftDate > today) return false;

  const start = timeToMinutes(openEntry.startTime);
  const end = timeToMinutes(openEntry.endTime);
  if (end <= start) return currentMinutes >= end && currentMinutes < start;
  return currentMinutes >= end;
}

export function getBrowserLocation() {
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

export function formatClockTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function timeToMinutes(value) {
  const [hours = 0, minutes = 0] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

export function isTimeInShift(currentMinutes, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return currentMinutes >= start || currentMinutes < end;
  return currentMinutes >= start && currentMinutes < end;
}
