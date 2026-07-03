import React from "react";
import { Bot, ImagePlus, Layers, Plus, Trash2, Wand2 } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, darkButton, primaryButton, softButton } from "../components/PageHeader.jsx";
import { formatShiftRange, getMonday, toDateInputValue } from "../dateUtils.js";

const dayNames = [
  { offset: 0, label: "Monday", match: /^mon(day)?$/i },
  { offset: 1, label: "Tuesday", match: /^tue(sday)?$/i },
  { offset: 2, label: "Wednesday", match: /^wed(nesday)?$/i },
  { offset: 3, label: "Thursday", match: /^thu(rsday)?$/i },
  { offset: 4, label: "Friday", match: /^fri(day)?$/i },
  { offset: 5, label: "Saturday", match: /^sat(urday)?$/i },
  { offset: 6, label: "Sunday", match: /^sun(day)?$/i }
];

const sampleText = `Monday VITHTHI 5.30am-7pm Shopping
Monday Afridi 6pm-10pm Shopping
Tuesday VITHTHI 5.30am-10pm
Wednesday VITHTHI 5.30am-4pm Cleaning
Wednesday Veera 1pm-10pm Cleaning
Thursday Veera 5.30am-10pm
Friday VITHTHI 1pm-10pm Shopping
Friday Veera 5.30am-2pm Shopping
Saturday VITHTHI 2pm-10pm
Saturday Veera 5.30am-2pm
Sunday Afridi 5.30am-10pm`;

export function RotaAi({ goTo }) {
  const [staff, setStaff] = React.useState([]);
  const [weekStart, setWeekStart] = React.useState(toDateInputValue(getMonday()));
  const [text, setText] = React.useState("");
  const [imagePreview, setImagePreview] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    api.staff()
      .then((rows) => setStaff(rows.filter((person) => person.active)))
      .catch((err) => setError(err.message));
  }, []);

  const parseText = () => {
    const result = parseRotaText(text, staff);
    setRows(result.rows);
    setError(result.errors[0] || "");
    setMessage(result.rows.length ? `Detected ${result.rows.length} shifts. Review them before sending to Pattern.` : "No shifts detected yet.");
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const removeRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const sendToPattern = () => {
    sessionStorage.setItem("fuelopsRotaAiRows", JSON.stringify({ weekStart, rows }));
    goTo("rota-pattern");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin helper"
        title="Rota AI"
        description="Paste a rota or upload an image for reference. This free helper detects names, days, hours, and notes locally before sending them to Rota Pattern."
        meta={<Pill tone="lime">{rows.length} detected</Pill>}
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <Field label="Pattern week start">
              <input
                type="date"
                className={inputClass}
                value={weekStart}
                onChange={(event) => setWeekStart(toDateInputValue(getMonday(new Date(`${event.target.value}T00:00:00`))))}
              />
            </Field>
            <Field label="Type or paste rota text">
              <textarea
                className={`${inputClass} min-h-72 font-mono text-sm`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={sampleText}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButton} onClick={parseText}>
                <Wand2 size={18} />
                Generate from text
              </button>
              <button type="button" className={softButton} onClick={() => setText(sampleText)}>
                <Plus size={18} />
                Use example
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-fuel-line bg-fuel-mist/50 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md bg-white p-6 text-center font-black text-fuel-green shadow-sm">
                <ImagePlus size={34} />
                Upload rota image
                <span className="text-xs font-bold text-slate-500">Image is used as a reference while you type or paste text.</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </label>
              {imagePreview ? (
                <img src={imagePreview} alt="Uploaded rota reference" className="mt-4 max-h-80 w-full rounded-md border border-fuel-line object-contain" />
              ) : (
                <div className="mt-4 rounded-md bg-white p-4 text-sm font-bold text-slate-500">
                  Free mode does not send your rota image to any paid AI service. For now, upload the image, then type or paste the visible rota text into the box.
                </div>
              )}
            </div>
            <div className="rounded-md bg-fuel-mist p-4 text-sm font-bold text-slate-700">
              Best format: one shift per line, for example `Monday Afridi 6pm-10pm Shopping`.
            </div>
          </div>
        </div>
      </Card>

      {(error || message) && (
        <p className={`rounded-md p-3 font-black ${error ? "bg-red-50 text-red-700" : "bg-fuel-mist text-fuel-green"}`}>
          {error || message}
        </p>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-black">Detected rota</h3>
            <p className="text-sm font-bold text-slate-600">Check every row before generating a long rota.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={softButton} onClick={() => setRows([])} disabled={!rows.length}>
              Clear
            </button>
            <button type="button" className={darkButton} onClick={sendToPattern} disabled={!rows.length}>
              <Layers size={18} />
              Send to Pattern
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Day</th>
                <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Staff</th>
                <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Hours</th>
                <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Note</th>
                <th className="border border-fuel-line bg-fuel-mist px-3 py-3 text-sm font-black">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="border border-fuel-line px-3 py-8 text-center font-bold text-slate-400">
                    No detected shifts yet.
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-fuel-line px-3 py-3 font-bold">{dayNames[row.dayOffset]?.label}</td>
                  <td className="border border-fuel-line px-3 py-3 font-black">{staff.find((person) => String(person.id) === String(row.staffId))?.name}</td>
                  <td className="border border-fuel-line px-3 py-3 font-bold text-fuel-green">{formatShiftRange(row.startTime, row.endTime)}</td>
                  <td className="border border-fuel-line px-3 py-3 font-bold text-slate-600">{row.notes || "-"}</td>
                  <td className="border border-fuel-line px-3 py-3">
                    <button type="button" className="rounded-md bg-red-50 p-2 text-red-700" onClick={() => removeRow(row.id)} title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function parseRotaText(text, staff) {
  const rows = [];
  const errors = [];
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const day = findDay(line);
    const staffMember = findStaff(line, staff);
    const timeRange = findTimeRange(line);
    if (!day || !staffMember || !timeRange) continue;

    const notes = line
      .replace(new RegExp(day.label, "i"), "")
      .replace(new RegExp(escapeRegExp(staffMember.name), "i"), "")
      .replace(timeRange.raw, "")
      .replace(/\b(off|total hours?)\b/gi, "")
      .trim();

    rows.push({
      id: crypto.randomUUID(),
      staffId: String(staffMember.id),
      dayOffset: day.offset,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      breakMinutes: 0,
      reminderMinutes: 30,
      notes
    });
  }

  if (!rows.length && lines.length) {
    errors.push("Could not detect shifts. Use lines like: Monday Afridi 6pm-10pm Shopping.");
  }
  return { rows, errors };
}

function findDay(line) {
  const words = line.split(/[\s,|/]+/);
  return daysFromWords(words) || dayNames.find((day) => new RegExp(`\\b${day.label}\\b`, "i").test(line));
}

function daysFromWords(words) {
  for (const word of words) {
    const day = dayNames.find((item) => item.match.test(word));
    if (day) return day;
  }
  return null;
}

function findStaff(line, staff) {
  const normalisedLine = normaliseName(line);
  return staff.find((person) => normalisedLine.includes(normaliseName(person.name)));
}

function findTimeRange(line) {
  const match = line.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  const start = toTime(match[1], match[2], match[3], match[6], true);
  const end = toTime(match[4], match[5], match[6], match[3], false);
  return { raw: match[0], startTime: start, endTime: end };
}

function toTime(hourValue, minuteValue = "00", period, oppositePeriod, isStart) {
  let hour = Number(hourValue);
  const minutes = String(minuteValue || "00").padStart(2, "0");
  const cleanPeriod = String(period || "").toLowerCase();
  const other = String(oppositePeriod || "").toLowerCase();

  if (cleanPeriod === "pm" && hour < 12) hour += 12;
  if (cleanPeriod === "am" && hour === 12) hour = 0;
  if (!cleanPeriod && other === "pm") {
    if (isStart && hour >= 1 && hour <= 4) hour += 12;
    if (!isStart && hour < 12) hour += 12;
  }
  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function normaliseName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
