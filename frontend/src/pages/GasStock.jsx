import React from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Minus, PackageCheck, Plus, Save, Send } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { PageHeader, Pill, primaryButton, softButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";

export function GasStock({ currentUser }) {
  const [weekStart, setWeekStart] = React.useState(() => mondayForDate(new Date()));
  const [data, setData] = React.useState(null);
  const [quantities, setQuantities] = React.useState({});
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    api.gasStock(weekStart)
      .then((result) => {
        setData(result);
        setNotes(result.notes || "");
        setQuantities(Object.fromEntries(result.products.map((product) => [
          product.id,
          product.quantity === null ? "" : String(product.quantity)
        ])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [weekStart]);

  React.useEffect(() => load(), [load]);

  const save = async (submit) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = submit
        ? await api.submitGasStock({ weekStart, quantities, notes })
        : await api.saveGasStockDraft({ weekStart, quantities, notes });
      setData(saved);
      setMessage(submit ? "Gas stock count submitted and weekly task completed." : "Draft saved. You can return and finish it later.");
      setConfirmSubmit(false);
      setNotes(saved.notes || "");
      setQuantities(Object.fromEntries(saved.products.map((product) => [product.id, product.quantity === null ? "" : String(product.quantity)])));
    } catch (err) {
      setError(err.message);
      setConfirmSubmit(false);
    } finally {
      setSaving(false);
    }
  };

  const changeQuantity = (productId, adjustment) => {
    setQuantities((current) => {
      const value = current[productId] === "" ? 0 : Number(current[productId] || 0);
      return { ...current, [productId]: String(Math.max(0, value + adjustment)) };
    });
  };

  const enteredProducts = data?.products.filter((product) => quantities[product.id] !== "").length || 0;
  const totalBottles = data?.products.reduce((total, product) => total + Number(quantities[product.id] || 0), 0) || 0;
  const lowStock = data?.products.filter((product) => {
    const value = quantities[product.id];
    return value !== "" && Number(value) <= Number(product.reorderLevel || 0);
  }).length || 0;
  const submitted = data?.count?.status === "submitted";
  const readOnly = !data?.canEdit || (submitted && currentUser?.role !== "admin");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Weekly task"
        title="Gas Stock Count"
        description="Record the full bottles on site. Save a draft while counting, then submit to complete the weekly task."
        meta={(
          <Pill tone={submitted ? "green" : "slate"}>
            {submitted ? <CheckCircle2 size={18} /> : <PackageCheck size={18} />}
            {submitted ? "Submitted" : data?.count?.status === "draft" ? "Draft" : "Not started"}
          </Pill>
        )}
      />

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-fuel-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-fuel-green">Count week</p>
            <h2 className="mt-1 text-xl font-black">{formatRange(data?.weekStart, data?.weekEnd)}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">Due {formatDate(data?.dueDate)}{data?.task?.assignedStaffName ? ` · Assigned to ${data.task.assignedStaffName}` : " · Any staff member"}</p>
          </div>
          {currentUser?.role === "admin" ? (
            <div className="flex gap-2">
              <button type="button" className={softButton} onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={18} /> Previous</button>
              <button type="button" className={softButton} onClick={() => setWeekStart(addDays(weekStart, 7))}>Next <ChevronRight size={18} /></button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-px bg-fuel-line sm:grid-cols-4">
          <Summary label="Full bottles" value={totalBottles} />
          <Summary label="Products counted" value={`${enteredProducts}/${data?.products.length || 0}`} />
          <Summary label="Low stock" value={lowStock} warning={lowStock > 0} />
          <Summary label="Task status" value={submitted ? "Done" : data?.task?.status === "process" ? "Doing" : "To do"} />
        </div>
      </Card>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
      {!data?.config?.enabled && !loading ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">Gas stock counting is disabled. An admin can enable it in Settings.</div> : null}
      {!data?.canEdit && data?.config?.enabled && !submitted && !loading ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 font-bold text-blue-800">This week’s count is assigned to another staff member. You can view it but cannot change it.</div> : null}

      <Status loading={loading} error="" empty={!loading && !data}>
        {data ? (
          <Card className="p-0 overflow-hidden">
            <div className="hidden grid-cols-[1.5fr_0.7fr_1fr_0.7fr_0.8fr] gap-3 border-b border-fuel-line bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500 md:grid">
              <span>Product</span><span>Last week</span><span>Current full bottles</span><span>Change</span><span>Status</span>
            </div>
            <div className="divide-y divide-fuel-line">
              {data.products.map((product) => {
                const current = quantities[product.id];
                const change = current !== "" && product.previousQuantity !== null ? Number(current) - product.previousQuantity : null;
                const isLow = current !== "" && Number(current) <= Number(product.reorderLevel || 0);
                return (
                  <div key={product.id} className="grid gap-3 p-4 md:grid-cols-[1.5fr_0.7fr_1fr_0.7fr_0.8fr] md:items-center md:px-5">
                    <div>
                      <p className="font-black text-slate-900">{product.name}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">Low-stock level: {product.reorderLevel}</p>
                    </div>
                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs font-black uppercase text-slate-400 md:hidden">Last week</span>
                      <span className="font-black text-blue-700">{product.previousQuantity ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={readOnly} aria-label={`Reduce ${product.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-fuel-mist text-fuel-green disabled:opacity-40" onClick={() => changeQuantity(product.id, -1)}><Minus size={17} /></button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        disabled={readOnly}
                        aria-label={`${product.name} full bottle quantity`}
                        className="h-11 min-w-0 w-full rounded-md border border-fuel-line bg-white px-3 text-center text-lg font-black outline-none focus:border-fuel-green disabled:bg-slate-50"
                        value={current}
                        onChange={(event) => setQuantities((values) => ({ ...values, [product.id]: event.target.value }))}
                      />
                      <button type="button" disabled={readOnly} aria-label={`Add ${product.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-fuel-mist text-fuel-green disabled:opacity-40" onClick={() => changeQuantity(product.id, 1)}><Plus size={17} /></button>
                    </div>
                    <div className="flex items-center justify-between md:block">
                      <span className="text-xs font-black uppercase text-slate-400 md:hidden">Change</span>
                      <span className={`font-black ${change > 0 ? "text-emerald-700" : change < 0 ? "text-red-700" : "text-slate-500"}`}>{change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}</span>
                    </div>
                    <div>{isLow ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800"><AlertTriangle size={14} /> Low</span> : current !== "" ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"><CheckCircle2 size={14} /> OK</span> : <span className="text-sm font-bold text-slate-400">Not counted</span>}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}
      </Status>

      {data ? (
        <Card>
          <label className="block text-sm font-black text-slate-700" htmlFor="gas-stock-notes">Communication / notes</label>
          <textarea id="gas-stock-notes" disabled={readOnly} className="mt-2 min-h-24 w-full rounded-lg border border-fuel-line p-3 font-bold outline-none focus:border-fuel-green disabled:bg-slate-50" placeholder="Add damaged bottles, delivery notes, or anything the manager should know." value={notes} onChange={(event) => setNotes(event.target.value)} />
          {!readOnly ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {!submitted ? <button type="button" disabled={saving} className={softButton} onClick={() => save(false)}><Save size={18} /> Save draft</button> : null}
              <button type="button" disabled={saving} className={primaryButton} onClick={() => setConfirmSubmit(true)}><Send size={18} /> {submitted ? "Update submitted count" : "Review & submit"}</button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {confirmSubmit ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-gas-stock-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-fuel-green"><PackageCheck size={24} /></div>
            <h2 id="submit-gas-stock-title" className="mt-4 text-xl font-black">Submit this week’s count?</h2>
            <p className="mt-2 font-bold text-slate-600">All {data?.products.length || 0} products need a quantity. Submitting will mark the linked weekly task as done.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className={softButton} onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button type="button" disabled={saving} className={primaryButton} onClick={() => save(true)}><CheckCircle2 size={18} /> {saving ? "Submitting..." : "Submit count"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value, warning = false }) {
  return <div className="bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${warning ? "text-amber-700" : "text-slate-950"}`}>{value}</p></div>;
}

function mondayForDate(date) {
  const value = new Date(date);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return toDate(value);
}

function addDays(dateString, amount) {
  const value = new Date(`${dateString}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return toDate(value);
}

function toDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatRange(start, end) {
  if (!start || !end) return "Loading week…";
  return `${formatDate(start)} – ${formatDate(end)}`;
}
