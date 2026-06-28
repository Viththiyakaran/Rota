import { formatDateLabel } from "./dateUtils.js";

export function whatsappReminderUrl(reminder) {
  const phone = normalisePhone(reminder.phone);
  const message = [
    `Hi ${reminder.staffName},`,
    reminder.reminderMessage,
    `Shift: ${formatDateLabel(reminder.shiftDate)}, ${reminder.startTime} - ${reminder.endTime}`,
    reminder.isExtra && reminder.coverForStaffName ? `Extra cover for ${reminder.coverForStaffName}` : "",
    reminder.notes ? `Note: ${reminder.notes}` : ""
  ].filter(Boolean).join("\n");

  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function whatsappGroupShareUrl({ weekRange, weekDays, shifts, formatDay, formatRange }) {
  const lines = [`FuelOps Rota`, weekRange, ""];

  for (const day of weekDays) {
    const dayShifts = shifts.filter((shift) => shift.shiftDate === day);
    lines.push(formatDay(day));

    if (dayShifts.length === 0) {
      lines.push("No shifts");
    } else {
      for (const shift of dayShifts) {
        const parts = [
          `${shift.staffName}: ${formatRange(shift.startTime, shift.endTime)}`,
          shift.isExtra && shift.coverForStaffName ? `(Extra cover for ${shift.coverForStaffName})` : "",
          shift.notes ? `- ${shift.notes}` : ""
        ].filter(Boolean);
        lines.push(parts.join(" "));
      }
    }

    lines.push("");
  }

  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n").trim())}`;
}

function normalisePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  return digits;
}
