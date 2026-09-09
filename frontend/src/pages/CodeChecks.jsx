import React from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Barcode,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, dangerButton, primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { toDateInputValue } from "../dateUtils.js";

const AREAS = ["Confectionery", "Chilled", "Drinks", "Grocery", "Medicine", "Frozen", "Other"];
const ACTIONS = ["Removed from sale", "Reduced to clear", "Returned to supplier", "Recorded as waste", "Sold before expiry", "Other"];

function emptyForm() {
  return {
    checkedDate: toDateInputValue(new Date()),
    productName: "",
    barcode: "",
    quantity: "1",
    sellByDate: "",
    area: "",
    notes: ""
  };
}

export function CodeChecks({ currentUser }) {
  const [rows, setRows] = React.useState([]);
  const [view, setView] = React.useState("attention");
  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [clearingId, setClearingId] = React.useState(null);
  const [actionTaken, setActionTaken] = React.useState(ACTIONS[0]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [reportMonth, setReportMonth] = React.useState(toDateInputValue(new Date()).slice(0, 7));
  const isAdmin = currentUser?.role === "admin";

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    api.codeChecks()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  const today = toDateInputValue(new Date());
  const openRows = rows.filter((row) => row.status === "open");
  const expired = openRows.filter((row) => daysUntil(row.sellByDate, today) < 0);
  const dueSoon = openRows.filter((row) => daysUntil(row.sellByDate, today) >= 0 && daysUntil(row.sellByDate, today) <= 7);
  const dueThisMonth = openRows.filter((row) => daysUntil(row.sellByDate, today) > 7 && daysUntil(row.sellByDate, today) <= 30);
  const awaitingSignOff = rows.filter((row) => row.status === "cleared" && !row.signedOffAt);
  const visibleRows = rows.filter((row) => {
    if (view === "attention") return row.status === "open";
    if (view === "cleared") return row.status === "cleared";
    return true;
  });
  const productSuggestions = [...new Set(rows.map((row) => row.productName).filter(Boolean))].sort();
  const reportRows = rows
    .filter((row) => row.checkedDate?.startsWith(reportMonth))
    .sort((left, right) => `${left.checkedDate}${left.productName}`.localeCompare(`${right.checkedDate}${right.productName}`));

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form, quantity: Number(form.quantity) };
      const saved = editingId
        ? await api.updateCodeCheck(editingId, payload)
        : await api.createCodeCheck(payload);
      setRows((current) => editingId
        ? current.map((row) => row.id === saved.id ? saved : row)
        : [saved, ...current]);
      setMessage(editingId ? "Code-check item updated." : "Short-dated product recorded.");
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      checkedDate: row.checkedDate,
      productName: row.productName,
      barcode: row.barcode || "",
      quantity: String(row.quantity),
      sellByDate: row.sellByDate,
      area: row.area || "",
      notes: row.notes || ""
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const mutate = async (operation, successMessage) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await operation();
      if (saved) setRows((current) => current.map((row) => row.id === saved.id ? saved : row));
      setMessage(successMessage);
      setClearingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete the code-check record for ${row.productName}?`)) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteCodeCheck(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage("Code-check record deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const printReport = () => window.print();

  const shareReport = async () => {
    setError("");
    setMessage("");
    const filename = `code-check-${reportMonth}.csv`;
    const file = new File([buildReportCsv(reportRows)], filename, { type: "text/csv;charset=utf-8" });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `Monthly Code Checklist - ${formatMonth(reportMonth)}`,
          text: `${reportRows.length} code-check record${reportRows.length === 1 ? "" : "s"} for ${formatMonth(reportMonth)}.`,
          files: [file]
        });
        setMessage("Monthly code-check report shared.");
        return;
      }
      downloadFile(file, filename);
      setMessage("Sharing is not available in this browser, so the monthly report was downloaded instead.");
    } catch (err) {
      if (err.name !== "AbortError") setError("The monthly report could not be shared. Please use Print and save it as a PDF.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Stock safety"
        title="Code Check"
        description="Record short-dated products during physical shelf checks, clear them safely, and keep a manager sign-off trail."
        action={(
          <button type="button" className={primaryButton} onClick={() => { setForm(emptyForm()); setEditingId(null); setFormOpen((open) => !open); }}>
            {formOpen ? <X size={18} /> : <Plus size={18} />} {formOpen ? "Close" : "Record product"}
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={AlertTriangle} label="Expired" value={expired.length} tone={expired.length ? "red" : "green"} />
        <Metric icon={CalendarClock} label="Within 7 days" value={dueSoon.length} tone={dueSoon.length ? "amber" : "green"} />
        <Metric icon={PackageSearch} label="Within 30 days" value={dueThisMonth.length} tone="blue" />
        <Metric icon={ShieldCheck} label="Awaiting sign-off" value={awaitingSignOff.length} tone={awaitingSignOff.length ? "amber" : "green"} />
      </div>

      <Card className="print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-fuel-green">Monthly checklist</p>
            <h2 className="mt-1 text-xl font-black text-fuel-ink">Print or share the final record</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">The report contains the seven useful columns from the paper sheet and leaves out internal app details.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Report month">
              <input aria-label="Report month" type="month" className={`${inputClass} min-w-44`} value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} />
            </Field>
            <button type="button" className={softButton} onClick={printReport}><Printer size={18} /> Print / PDF</button>
            <button type="button" className={primaryButton} onClick={shareReport}><Share2 size={18} /> Share</button>
          </div>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500">{reportRows.length} record{reportRows.length === 1 ? "" : "s"} in {formatMonth(reportMonth)}</p>
      </Card>

      {formOpen && (
        <Card className="border-blue-200 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-fuel-green">Physical shelf check</p>
              <h2 className="mt-1 text-xl font-black text-fuel-ink">{editingId ? "Edit recorded product" : "Record a short-dated product"}</h2>
            </div>
            <Pill tone="slate"><ClipboardCheck size={16} /> No POS required</Pill>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <Field label="Product name *">
              <input required list="code-check-products" className={inputClass} value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} placeholder="e.g. Kinder Cards" />
              <datalist id="code-check-products">{productSuggestions.map((name) => <option value={name} key={name} />)}</datalist>
            </Field>
            <Field label="Area">
              <select className={inputClass} value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })}>
                <option value="">Select an area</option>
                {AREAS.map((area) => <option key={area}>{area}</option>)}
              </select>
            </Field>
            <Field label="Quantity found *">
              <input required min="1" step="1" inputMode="numeric" type="number" className={inputClass} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            </Field>
            <Field label="Sell-by / use-by date *">
              <input required type="date" className={inputClass} value={form.sellByDate} onChange={(event) => setForm({ ...form, sellByDate: event.target.value })} />
            </Field>
            <Field label="Date checked *">
              <input required type="date" className={inputClass} value={form.checkedDate} onChange={(event) => setForm({ ...form, checkedDate: event.target.value })} />
            </Field>
            <Field label="Barcode (optional)">
              <div className="relative">
                <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                <input inputMode="numeric" className={`${inputClass} pl-10`} value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} placeholder="Type or scan product barcode" />
              </div>
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <textarea className={`${inputClass} min-h-24`} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Shelf location, batch, damage, or instructions" />
              </Field>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:col-span-2 md:justify-end">
              <button type="button" className={softButton} onClick={resetForm}>Cancel</button>
              <button disabled={saving} className={primaryButton}><Save size={18} /> {saving ? "Saving..." : editingId ? "Save changes" : "Add to code check"}</button>
            </div>
          </form>
        </Card>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-bold text-red-700">{error}</p>}
      {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{message}</p>}

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-fuel-line bg-white p-1.5 shadow-sm">
        <Tab active={view === "attention"} label={`Attention (${openRows.length})`} onClick={() => setView("attention")} />
        <Tab active={view === "cleared"} label={`Cleared (${rows.length - openRows.length})`} onClick={() => setView("cleared")} />
        <Tab active={view === "all"} label="All" onClick={() => setView("all")} />
      </div>

      <Status loading={loading} error="" empty={!loading && visibleRows.length === 0} emptyMessage={view === "attention" ? "No products currently need attention." : "No code-check records in this view."}>
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <CodeCheckCard
              actionTaken={actionTaken}
              clearing={clearingId === row.id}
              isAdmin={isAdmin}
              key={row.id}
              onActionChange={setActionTaken}
              onCancelClear={() => setClearingId(null)}
              onClear={() => mutate(() => api.clearCodeCheck(row.id, actionTaken), `${row.productName} marked as cleared.`)}
              onDelete={() => remove(row)}
              onEdit={() => edit(row)}
              onReopen={() => mutate(() => api.reopenCodeCheck(row.id), `${row.productName} reopened.`)}
              onSignOff={() => mutate(() => api.signOffCodeCheck(row.id), `${row.productName} signed off.`)}
              onStartClear={() => { setActionTaken(ACTIONS[0]); setClearingId(row.id); }}
              row={row}
              saving={saving}
              today={today}
            />
          ))}
        </div>
      </Status>

      <Card className="bg-slate-50">
        <div className="flex gap-3">
          <Barcode className="mt-0.5 shrink-0 text-fuel-green" size={21} />
          <div>
            <p className="font-black text-fuel-ink">How this works without the POS</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">Staff record only products found during a physical code check. A normal barcode identifies a product but usually does not contain its expiry date, so the printed date must still be entered. Update the quantity when the product is physically checked or cleared.</p>
          </div>
        </div>
      </Card>

      <MonthlyPrintReport month={reportMonth} rows={reportRows} />
    </div>
  );
}

function MonthlyPrintReport({ month, rows }) {
  return (
    <section className="code-check-print-area" aria-hidden="true">
      <header>
        <p className="print-kicker">LocalPlanner · Stock safety</p>
        <div className="print-title-row">
          <div>
            <h1>Code Checklist <span>– Monthly</span></h1>
            <p>Record products found during physical code checks that must be reduced, removed, returned or otherwise cleared.</p>
          </div>
          <div className="print-month"><small>Month</small><strong>{formatMonth(month)}</strong></div>
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Sell-by date</th>
            <th>Action taken</th>
            <th>Date cleared</th>
            <th>Sign-off</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatShortDate(row.checkedDate)}</td>
              <td>{row.productName}</td>
              <td>{row.quantity}</td>
              <td>{formatShortDate(row.sellByDate)}</td>
              <td>{row.actionTaken || ""}</td>
              <td>{row.clearedAt ? formatShortDate(row.clearedAt.slice(0, 10)) : ""}</td>
              <td>{row.signedOffAt ? `${row.signedOffByName} · ${formatShortDate(row.signedOffAt.slice(0, 10))}` : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="print-empty" colSpan="7">No products recorded for this month.</td></tr>}
        </tbody>
      </table>
      <footer>
        <span>Generated from LocalPlanner on {formatDate(toDateInputValue(new Date()))}</span>
        <span>{rows.length} product record{rows.length === 1 ? "" : "s"}</span>
      </footer>
    </section>
  );
}

function CodeCheckCard({ actionTaken, clearing, isAdmin, onActionChange, onCancelClear, onClear, onDelete, onEdit, onReopen, onSignOff, onStartClear, row, saving, today }) {
  const urgency = getUrgency(row, today);
  return (
    <Card className={`overflow-hidden p-0 ${urgency.border}`}>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.3fr_0.8fr_0.8fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-fuel-ink">{row.productName}</h3>
            <Pill tone={urgency.tone}>{urgency.label}</Pill>
            {row.signedOffAt && <Pill tone="green"><BadgeCheck size={15} /> Signed off</Pill>}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-500">{row.area || "Area not specified"}{row.barcode ? ` · Barcode ${row.barcode}` : ""}</p>
          {row.notes && <p className="mt-2 text-sm font-medium text-slate-600">{row.notes}</p>}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Quantity</p>
          <p className="mt-1 text-xl font-black text-fuel-ink">{row.quantity}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Found {formatDate(row.checkedDate)}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Sell by / use by</p>
          <p className={`mt-1 text-lg font-black ${urgency.text}`}>{formatDate(row.sellByDate)}</p>
          {row.status === "cleared" && <p className="mt-1 text-xs font-bold text-slate-500">{row.actionTaken} · {formatDateTime(row.clearedAt)}</p>}
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-[250px] lg:justify-end">
          {row.status === "open" ? (
            <>
              <button type="button" className={softButton} onClick={onEdit}><Pencil size={17} /> Edit</button>
              <button type="button" className={primaryButton} onClick={onStartClear}><CheckCircle2 size={17} /> Clear item</button>
            </>
          ) : (
            <>
              {isAdmin && !row.signedOffAt && <button disabled={saving} type="button" className={primaryButton} onClick={onSignOff}><ShieldCheck size={17} /> Sign off</button>}
              {isAdmin && <button disabled={saving} type="button" className={softButton} onClick={onReopen}><RotateCcw size={17} /> Reopen</button>}
            </>
          )}
          {isAdmin && <button disabled={saving} type="button" className={dangerButton} onClick={onDelete} title="Delete record"><Trash2 size={17} /></button>}
        </div>
      </div>
      <div className="border-t border-fuel-line bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
        Recorded by {row.recordedByName} {formatDateTime(row.createdAt)}
        {row.signedOffAt ? ` · Signed off by ${row.signedOffByName} ${formatDateTime(row.signedOffAt)}` : ""}
      </div>
      {clearing && (
        <div className="border-t border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-black text-fuel-ink">What action was taken?</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select className={inputClass} value={actionTaken} onChange={(event) => onActionChange(event.target.value)}>
              {ACTIONS.map((action) => <option key={action}>{action}</option>)}
            </select>
            <button disabled={saving} type="button" className={primaryButton} onClick={onClear}><CheckCircle2 size={17} /> Confirm cleared</button>
            <button disabled={saving} type="button" className={softButton} onClick={onCancelClear}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ icon: Icon, label, tone, value }) {
  const tones = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-800", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700" };
  return <Card className="p-3.5"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={20} /></span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-xl font-black text-fuel-ink">{value}</p></div></div></Card>;
}

function Tab({ active, label, onClick }) {
  return <button type="button" className={`min-h-11 rounded-lg px-2 text-sm font-black transition ${active ? "bg-fuel-green text-white" : "text-slate-600 hover:bg-fuel-mist"}`} onClick={onClick}>{label}</button>;
}

function getUrgency(row, today) {
  if (row.status === "cleared") return { label: "Cleared", tone: "green", border: "", text: "text-emerald-700" };
  const days = daysUntil(row.sellByDate, today);
  if (days < 0) return { label: "Expired", tone: "red", border: "border-red-200", text: "text-red-700" };
  if (days === 0) return { label: "Expires today", tone: "red", border: "border-red-200", text: "text-red-700" };
  if (days <= 3) return { label: `${days} day${days === 1 ? "" : "s"} left`, tone: "red", border: "border-red-200", text: "text-red-700" };
  if (days <= 7) return { label: `${days} days left`, tone: "amber", border: "border-amber-200", text: "text-amber-700" };
  if (days <= 30) return { label: `${days} days left`, tone: "slate", border: "", text: "text-fuel-ink" };
  return { label: "Recorded", tone: "slate", border: "", text: "text-fuel-ink" };
}

function daysUntil(date, today) {
  return Math.round((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

function formatMonth(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
}

function buildReportCsv(rows) {
  const columns = ["Date", "Product", "Quantity", "Sell By Date", "Action Taken", "Date Cleared", "Sign Off"];
  const values = rows.map((row) => [
    row.checkedDate,
    row.productName,
    row.quantity,
    row.sellByDate,
    row.actionTaken || "",
    row.clearedAt ? row.clearedAt.slice(0, 10) : "",
    row.signedOffAt ? `${row.signedOffByName} (${row.signedOffAt.slice(0, 10)})` : ""
  ]);
  return [columns, ...values].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(file, filename) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
