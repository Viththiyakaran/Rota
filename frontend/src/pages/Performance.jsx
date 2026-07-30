import React from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Minus,
  PoundSterling,
  Save,
  Share2,
  TrendingUp
} from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { PageHeader, Pill, primaryButton, softButton } from "../components/PageHeader.jsx";
import { addDays, formatDateLabel, formatDayLabel, getMonday, toDateInputValue } from "../dateUtils.js";

export function Performance({ branding }) {
  const [weekStart, setWeekStart] = React.useState(() => getMonday(new Date()));
  const currentDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(weekStart, index))),
    [weekStart]
  );
  const previousDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(weekStart, index - 7))),
    [weekStart]
  );
  const [values, setValues] = React.useState({});
  const [communication, setCommunication] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [whatsappUrl, setWhatsappUrl] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    setError("");
    setMessage("");
    setWhatsappUrl("");
    Promise.all([
      api.sales(previousDates[0], currentDates[6]),
      api.salesCommunication(currentDates[0])
    ])
      .then(([rows, weeklyNote]) => {
        setValues(Object.fromEntries(rows.map((row) => [row.saleDate, String(row.amount)])));
        setCommunication(weeklyNote.communication || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentDates, previousDates]);

  const comparison = buildComparison(currentDates, previousDates, values);
  const currentTotal = sumSales(currentDates, values);
  const previousTotal = sumSales(previousDates, values);
  const percentage = comparison.previousTotal > 0
    ? (comparison.difference / comparison.previousTotal) * 100
    : null;

  const updateValue = (date, value) => {
    setValues((current) => ({ ...current, [date]: value }));
    setMessage("");
  };

  const savePerformance = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const dates = [...previousDates, ...currentDates];
      await Promise.all([
        api.updateSales(dates.map((saleDate) => ({
          saleDate,
          amount: hasSalesValue(values[saleDate]) ? Number(values[saleDate]) : null
        }))),
        api.updateSalesCommunication({ weekStart: currentDates[0], communication })
      ]);
      setMessage("Performance tracker saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shareOnWhatsApp = async () => {
    setSharing(true);
    setError("");
    setMessage("");
    setWhatsappUrl("");
    try {
      const blob = await createTrackerImage({
        businessName: branding.businessName || "Your Business",
        communication,
        currentDates,
        previousDates,
        values,
        weekLabel: `${formatDateLabel(currentDates[0])} - ${formatDateLabel(currentDates[6])}`
      });
      const fileName = `performance-${currentDates[0]}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const shareData = {
        title: `${branding.businessName || "Business"} Performance Tracker`,
        text: `Performance tracker for ${formatDateLabel(currentDates[0])} to ${formatDateLabel(currentDates[6])}.`,
        files: [file]
      };

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
        setMessage("Performance image shared.");
      } else {
        downloadBlob(blob, fileName);
        const summary = `${branding.businessName || "Business"} performance tracker\n${formatDateLabel(currentDates[0])} - ${formatDateLabel(currentDates[6])}\nCurrent sales: ${formatCurrency(currentTotal)}\nLast week: ${formatCurrency(previousTotal)}\nCumulative: ${formatSignedCurrency(comparison.difference)}\n\nThe tracker image has been downloaded—attach it to this WhatsApp message.`;
        const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
        setWhatsappUrl(url);
        window.open(url, "_blank", "noopener,noreferrer");
        setMessage("Image downloaded. Attach it to the WhatsApp message that opened.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") setError(err.message || "Could not create the performance image.");
    } finally {
      setSharing(false);
    }
  };

  const isCurrentWeek = toDateInputValue(weekStart) === toDateInputValue(getMonday(new Date()));

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Admin performance"
        title="Performance Tracker"
        description="Compare daily sales with last week and share the finished board with the team."
        meta={(
          <Pill>
            <TrendingUp size={16} />
            {comparison.comparableDays} days compared
          </Pill>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Selected week</p>
            <p className="mt-1 text-lg font-black text-fuel-ink">
              {formatDateLabel(currentDates[0])} - {formatDateLabel(currentDates[6])}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" className={softButton} onClick={() => setWeekStart((date) => addDays(date, -7))}>
              <ArrowLeft size={18} />
              Previous
            </button>
            <button
              type="button"
              className={softButton}
              disabled={isCurrentWeek}
              onClick={() => setWeekStart((date) => addDays(date, 7))}
            >
              Next
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={loading || saving}
              onClick={savePerformance}
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={loading || sharing}
              onClick={shareOnWhatsApp}
            >
              <Share2 size={18} />
              {sharing ? "Creating image..." : "Share WhatsApp"}
            </button>
          </div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-black text-white"
          >
            <Share2 size={18} />
            Open WhatsApp
          </a>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <SalesSummary
          label="Sales (£)"
          value={formatCurrency(currentTotal)}
          helper={`${currentDates.filter((date) => hasSalesValue(values[date])).length}/7 figures entered`}
        />
        <SalesSummary
          label="Last week"
          value={formatCurrency(previousTotal)}
          helper={`${comparison.comparableDays} matching days compared`}
        />
        <SalesSummary
          label="Cumulative"
          value={formatSignedCurrency(comparison.difference)}
          helper={percentage === null ? "Enter matching days to calculate %" : `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}% vs last week`}
          trend={comparison.difference}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.9fr] gap-3 border-b border-fuel-line bg-fuel-deep px-5 py-3 text-xs font-black uppercase tracking-wide text-white">
              <span>Day</span>
              <span>Sales (£)</span>
              <span>Last Week</span>
              <span className="text-right">+/- LW</span>
              <span className="text-right">Cumulative</span>
            </div>
            {currentDates.map((currentDate, index) => {
              const row = comparison.rows[index];
              return (
                <div key={currentDate} className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.9fr] items-center gap-3 border-b border-fuel-line bg-white px-5 py-3 last:border-b-0">
                  <div>
                    <p className="font-black uppercase text-fuel-ink">
                      {new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${currentDate}T00:00:00`))}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">{formatDayLabel(currentDate)}</p>
                  </div>
                  <SalesInput
                    date={currentDate}
                    value={values[currentDate] ?? ""}
                    onChange={(value) => updateValue(currentDate, value)}
                    loading={loading}
                  />
                  <SalesInput
                    date={previousDates[index]}
                    value={values[previousDates[index]] ?? ""}
                    onChange={(value) => updateValue(previousDates[index], value)}
                    loading={loading}
                  />
                  <Difference value={row.difference} />
                  <Difference value={row.cumulative} />
                </div>
              );
            })}
            <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.9fr] items-center gap-3 bg-fuel-mist px-5 py-4">
              <span className="font-black uppercase text-fuel-ink">Total</span>
              <span className="font-black text-fuel-ink">{formatCurrency(currentTotal)}</span>
              <span className="font-black text-fuel-ink">{formatCurrency(previousTotal)}</span>
              <Difference value={comparison.difference} />
              <Difference value={comparison.difference} />
            </div>
          </div>
        </div>

        <div className="border-t border-fuel-line bg-slate-50 p-5">
          <label className="block">
            <span className="text-sm font-black uppercase tracking-wide text-fuel-ink">Communication</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">This message is included in the WhatsApp image.</span>
            <textarea
              rows="4"
              maxLength="2000"
              value={communication}
              disabled={loading}
              onChange={(event) => {
                setCommunication(event.target.value);
                setMessage("");
              }}
              placeholder="Example: Strong Tuesday. Focus on meal deals and impulse sales this weekend."
              className="mt-3 w-full resize-y rounded-lg border border-fuel-line bg-white p-3 text-sm font-semibold text-fuel-ink outline-none focus:border-fuel-green focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
          </label>
        </div>
      </Card>
    </div>
  );
}

function SalesInput({ date, loading, onChange, value }) {
  return (
    <label className="relative block">
      <span className="sr-only">Sales for {formatDayLabel(date)}</span>
      <PoundSterling className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max="100000000"
        step="0.01"
        disabled={loading}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={loading ? "Loading..." : "0.00"}
        className="min-h-11 w-full rounded-lg border border-fuel-line bg-white py-2 pl-9 pr-3 font-bold text-fuel-ink outline-none focus:border-fuel-green focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
      />
    </label>
  );
}

function SalesSummary({ helper, label, trend = 0, value }) {
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
  const trendClass = trend > 0 ? "text-emerald-700" : trend < 0 ? "text-red-700" : "text-slate-500";
  return (
    <Card className="p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-2xl font-black text-fuel-ink">{value}</p>
        {label === "Cumulative" && <TrendIcon className={`h-5 w-5 ${trendClass}`} />}
      </div>
      <p className={`mt-1 text-xs font-bold ${label === "Cumulative" ? trendClass : "text-slate-500"}`}>{helper}</p>
    </Card>
  );
}

function Difference({ value }) {
  const tone = value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : "text-slate-500";
  return <span className={`text-right text-sm font-black ${tone}`}>{formatSignedCurrency(value)}</span>;
}

function buildComparison(currentDates, previousDates, values) {
  let cumulative = 0;
  let currentTotal = 0;
  let previousTotal = 0;
  let comparableDays = 0;
  const rows = currentDates.map((date, index) => {
    const previousDate = previousDates[index];
    const comparable = hasSalesValue(values[date]) && hasSalesValue(values[previousDate]);
    if (!comparable) return { difference: null, cumulative: null };
    const current = numberFromInput(values[date]);
    const previous = numberFromInput(values[previousDate]);
    const difference = current - previous;
    currentTotal += current;
    previousTotal += previous;
    cumulative += difference;
    comparableDays += 1;
    return { difference, cumulative };
  });
  return { rows, currentTotal, previousTotal, difference: currentTotal - previousTotal, comparableDays };
}

function sumSales(dates, values) {
  return dates.reduce((total, date) => total + numberFromInput(values[date]), 0);
}

function numberFromInput(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function hasSalesValue(value) {
  return value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));
}

function formatSignedCurrency(value) {
  if (value === null || value === undefined) return "—";
  const number = Number(value || 0);
  if (number === 0) return "£0.00";
  return `${number > 0 ? "+" : "-"}${formatCurrency(Math.abs(number))}`;
}

async function createTrackerImage({ businessName, communication, currentDates, previousDates, values, weekLabel }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  const comparison = buildComparison(currentDates, previousDates, values);
  const currentTotal = sumSales(currentDates, values);
  const previousTotal = sumSales(previousDates, values);
  const columns = [230, 210, 210, 200, 230];
  const headers = ["", "SALES (£)", "LAST WEEK", "+/- LW", "CUMULATIVE"];
  const tableX = 60;
  const tableY = 225;
  const tableWidth = 1080;
  const headerHeight = 70;
  const rowHeight = 91;

  context.fillStyle = "#f4f6fa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 35, 35, 1130, 1280, 24, "#ffffff");

  context.fillStyle = "#07102e";
  context.font = "900 54px Arial";
  context.textAlign = "center";
  context.fillText("PERFORMANCE TRACKER", 600, 112);
  context.font = "700 25px Arial";
  context.fillStyle = "#334155";
  context.fillText(businessName, 600, 158);
  context.font = "600 20px Arial";
  context.fillStyle = "#64748b";
  context.fillText(weekLabel, 600, 191);

  let x = tableX;
  headers.forEach((header, index) => {
    context.fillStyle = "#101d4f";
    context.fillRect(x, tableY, columns[index], headerHeight);
    context.strokeStyle = "#ffffff";
    context.strokeRect(x, tableY, columns[index], headerHeight);
    context.fillStyle = "#ffffff";
    context.font = "800 22px Arial";
    context.textAlign = "center";
    context.fillText(header, x + columns[index] / 2, tableY + 43);
    x += columns[index];
  });

  currentDates.forEach((date, index) => {
    const y = tableY + headerHeight + index * rowHeight;
    const row = comparison.rows[index];
    const cells = [
      new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${date}T00:00:00`)).toUpperCase(),
      hasSalesValue(values[date]) ? formatCanvasMoney(values[date]) : "",
      hasSalesValue(values[previousDates[index]]) ? formatCanvasMoney(values[previousDates[index]]) : "",
      row.difference === null ? "" : formatCanvasSigned(row.difference),
      row.cumulative === null ? "" : formatCanvasSigned(row.cumulative)
    ];
    let cellX = tableX;
    cells.forEach((cell, cellIndex) => {
      context.fillStyle = index % 2 === 0 ? "#e9e8f4" : "#f4f3fa";
      context.fillRect(cellX, y, columns[cellIndex], rowHeight);
      context.strokeStyle = "#ffffff";
      context.strokeRect(cellX, y, columns[cellIndex], rowHeight);
      context.fillStyle = cellIndex === 2
        ? "#176ef2"
        : cellIndex >= 3 && Number(String(cell).replace(/[£+,]/g, "")) < 0
          ? "#b91c1c"
          : cellIndex >= 3 && String(cell).startsWith("+")
            ? "#047857"
            : "#0f172a";
      context.font = cellIndex === 0 ? "800 22px Arial" : "800 28px Arial";
      context.textAlign = cellIndex === 0 ? "left" : "center";
      context.fillText(cell, cellIndex === 0 ? cellX + 18 : cellX + columns[cellIndex] / 2, y + 55);
      cellX += columns[cellIndex];
    });
  });

  const totalY = tableY + headerHeight + 7 * rowHeight;
  const totalCells = [
    "TOTAL",
    formatCanvasMoney(currentTotal),
    formatCanvasMoney(previousTotal),
    formatCanvasSigned(comparison.difference),
    formatCanvasSigned(comparison.difference)
  ];
  x = tableX;
  totalCells.forEach((cell, index) => {
    context.fillStyle = "#dbeafe";
    context.fillRect(x, totalY, columns[index], rowHeight);
    context.strokeStyle = "#ffffff";
    context.strokeRect(x, totalY, columns[index], rowHeight);
    context.fillStyle = index === 2
      ? "#176ef2"
      : index >= 3 && comparison.difference < 0
        ? "#b91c1c"
        : index >= 3 && comparison.difference > 0
          ? "#047857"
          : "#0f172a";
    context.font = "900 25px Arial";
    context.textAlign = index === 0 ? "left" : "center";
    context.fillText(cell, index === 0 ? x + 18 : x + columns[index] / 2, totalY + 55);
    x += columns[index];
  });

  const communicationY = totalY + rowHeight + 30;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.fillRect(tableX, communicationY, tableWidth, 185);
  context.strokeRect(tableX, communicationY, tableWidth, 185);
  context.fillStyle = "#07102e";
  context.font = "900 22px Arial";
  context.textAlign = "left";
  context.fillText("COMMUNICATION", tableX + 20, communicationY + 38);
  context.fillStyle = "#334155";
  context.font = "600 21px Arial";
  wrapCanvasText(context, communication || "No communication added.", tableX + 20, communicationY + 75, tableWidth - 40, 29, 3);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create image.")), "image/png", 0.95);
  });
}

function roundedRect(context, x, y, width, height, radius, colour) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = colour;
  context.fill();
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

function formatCanvasMoney(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function formatCanvasSigned(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : number < 0 ? "-" : ""}£${Math.abs(number).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
