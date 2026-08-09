import React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  Pencil,
  PoundSterling,
  Plus,
  RotateCw,
  Save,
  Send,
  ShoppingCart,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, primaryButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { toDateInputValue } from "../dateUtils.js";

const DAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 0, short: "Sun", label: "Sunday" }
];
const MORRISONS_DEPARTMENTS = ["Ambient", "Tobacco", "Chilled", "Frozen"];
const SUGGESTED_ORDERS = [
  { name: "1st Order", supplier: "Morrisons", departments: MORRISONS_DEPARTMENTS },
  { name: "2nd Order", supplier: "Morrisons", departments: MORRISONS_DEPARTMENTS },
  { name: "Vape", supplier: "", departments: ["Total order"] },
  { name: "Medicine", supplier: "", departments: ["Total order"] },
  { name: "Sweets & confectionery", supplier: "", departments: ["Total order"] }
];
const EMPTY_PLAN = { name: "", supplier: "", weekdays: [], departments: ["Total order"], notes: "", assignedStaffId: "", active: true };

export function Tasks({ currentUser, goTo }) {
  const today = React.useMemo(() => toDateInputValue(new Date()), []);
  const weekStart = React.useMemo(() => mondayFor(today), [today]);
  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStart]);
  const [view, setView] = React.useState("week");
  const [tasks, setTasks] = React.useState([]);
  const [schedules, setSchedules] = React.useState([]);
  const [orderSummary, setOrderSummary] = React.useState([]);
  const [staff, setStaff] = React.useState([]);
  const [plan, setPlan] = React.useState(EMPTY_PLAN);
  const [editingPlanId, setEditingPlanId] = React.useState(null);
  const [showPlanForm, setShowPlanForm] = React.useState(false);
  const [selectedOrderTask, setSelectedOrderTask] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);
  const [quickTask, setQuickTask] = React.useState({ title: "", dueDate: today, assignedStaffId: "" });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const isAdmin = currentUser?.role === "admin";

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([api.tasks(), api.workSchedules(), api.staff(), api.workOrderSummary(weekStart)])
      .then(([taskRows, scheduleRows, staffRows, summaryRows]) => {
        setTasks(taskRows);
        setSchedules(scheduleRows);
        setStaff(staffRows.filter((person) => person.active));
        setOrderSummary(summaryRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [weekStart]);

  React.useEffect(() => load(), [load]);

  const activeWeekTasks = tasks.filter((task) =>
    task.status !== "done" && task.dueDate && (
      task.dueDate < today ||
      (task.dueDate >= weekStart && task.dueDate <= weekEnd)
    )
  );
  const doneThisWeek = tasks.filter((task) =>
    task.status === "done" && task.dueDate >= weekStart && task.dueDate <= weekEnd
  );
  const manualTasks = tasks.filter((task) => !task.taskType);
  const dueToday = activeWeekTasks.filter((task) => task.dueDate === today).length;
  const overdue = activeWeekTasks.filter((task) => task.dueDate < today).length;
  const weeklyOrderTotal = orderSummary
    .filter((order) => order.submissionStatus === "submitted")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  const updateTask = async (task, payload) => {
    setError("");
    try {
      const saved = await api.updateTask(task.id, payload);
      setTasks((rows) => rows.map((row) => row.id === saved.id ? saved : row));
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const submitPlan = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...plan, assignedStaffId: plan.assignedStaffId || null };
      if (editingPlanId) await api.updateWorkSchedule(editingPlanId, payload);
      else await api.createWorkSchedule(payload);
      setPlan(EMPTY_PLAN);
      setEditingPlanId(null);
      setShowPlanForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const editPlan = (schedule) => {
    setPlan({
      name: schedule.name,
      supplier: schedule.supplier || "",
      weekdays: schedule.weekdays || [],
      departments: schedule.departments || ["Total order"],
      notes: schedule.notes || "",
      assignedStaffId: schedule.assignedStaffId || "",
      active: schedule.active
    });
    setEditingPlanId(schedule.id);
    setShowPlanForm(true);
  };

  const createQuickTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await api.createTask({ ...quickTask, assignedStaffId: quickTask.assignedStaffId || null, status: "todo" });
      setTasks((rows) => [saved, ...rows]);
      setQuickTask({ title: "", dueDate: today, assignedStaffId: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      if (deleteTarget.type === "schedule") {
        await api.deleteWorkSchedule(deleteTarget.item.id);
        setDeleteTarget(null);
        load();
      } else {
        await api.deleteTask(deleteTarget.item.id);
        setTasks((rows) => rows.filter((row) => row.id !== deleteTarget.item.id));
        setDeleteTarget(null);
      }
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (selectedOrderTask) {
    return (
      <OrderEntry
        onBack={() => setSelectedOrderTask(null)}
        onSaved={(viewData) => {
          setTasks((rows) => rows.map((row) => row.id === viewData.task.id ? viewData.task : row));
          api.workOrderSummary(weekStart).then(setOrderSummary).catch(() => {});
        }}
        task={selectedOrderTask}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Station operations"
        title="Work"
        description="One place for this week's gas count, supplier orders and other shop jobs."
        meta={<Pill><CalendarCheck2 size={18} /> {formatWeek(weekStart, weekEnd)}</Pill>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Due today" value={dueToday} tone={dueToday ? "blue" : "slate"} />
        <Metric label="Overdue" value={overdue} tone={overdue ? "red" : "slate"} />
        <Metric label="Weekly order value" value={formatCurrency(weeklyOrderTotal)} tone="amber" />
        <Metric label="Completed" value={doneThisWeek.length} tone="green" />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-fuel-line bg-white p-1.5 shadow-sm">
        <ViewButton active={view === "week"} icon={CalendarCheck2} label="This week" onClick={() => setView("week")} />
        <ViewButton active={view === "plans"} icon={RotateCw} label="Order plans" onClick={() => setView("plans")} />
        <ViewButton active={view === "other"} icon={ClipboardList} label="Other tasks" onClick={() => setView("other")} />
      </div>

      {error && <p className="rounded-lg border border-red-100 bg-red-50 p-3 font-bold text-red-700">{error}</p>}

      <Status loading={loading} error="" empty={false}>
        {view === "week" && (
          <ThisWeek
            activeTasks={activeWeekTasks}
            doneTasks={doneThisWeek}
            goTo={goTo}
            onOpenOrder={setSelectedOrderTask}
            onUpdate={updateTask}
            orderSummary={orderSummary}
            today={today}
            weekStart={weekStart}
          />
        )}

        {view === "plans" && (
          <OrderPlans
            currentUser={currentUser}
            editPlan={editPlan}
            editingPlanId={editingPlanId}
            isAdmin={isAdmin}
            onCancel={() => { setPlan(EMPTY_PLAN); setEditingPlanId(null); setShowPlanForm(false); }}
            onDelete={(schedule) => setDeleteTarget({ type: "schedule", item: schedule })}
            onNew={(preset = null) => {
              setPlan(preset ? { ...EMPTY_PLAN, ...preset, departments: [...preset.departments] } : EMPTY_PLAN);
              setEditingPlanId(null);
              setShowPlanForm(true);
            }}
            plan={plan}
            saving={saving}
            schedules={schedules}
            setPlan={setPlan}
            showPlanForm={showPlanForm}
            staff={staff}
            submitPlan={submitPlan}
          />
        )}

        {view === "other" && (
          <OtherTasks
            currentUser={currentUser}
            form={quickTask}
            isAdmin={isAdmin}
            onCreate={createQuickTask}
            onDelete={(task) => setDeleteTarget({ type: "task", item: task })}
            onUpdate={updateTask}
            saving={saving}
            setForm={setQuickTask}
            staff={staff}
            tasks={manualTasks}
          />
        )}
      </Status>

      <DeleteConfirmationModal
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        target={deleteTarget}
      />
    </div>
  );
}

function DeleteConfirmationModal({ deleting, onCancel, onConfirm, target }) {
  const cancelRef = React.useRef(null);

  React.useEffect(() => {
    if (!target) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [deleting, onCancel, target]);

  if (!target) return null;
  const isSchedule = target.type === "schedule";
  const itemName = isSchedule
    ? `${target.item.supplier ? `${target.item.supplier} — ` : ""}${target.item.name}`
    : target.item.title;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={() => { if (!deleting) onCancel(); }}>
      <section
        aria-describedby="delete-confirmation-description"
        aria-labelledby="delete-confirmation-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100"><AlertTriangle size={22} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">Confirm deletion</p>
              <h2 id="delete-confirmation-title" className="mt-1 text-xl font-black text-fuel-ink">{isSchedule ? "Delete order plan?" : "Delete task?"}</h2>
            </div>
          </div>
          <button type="button" aria-label="Close confirmation" disabled={deleting} onClick={onCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"><X size={18} /></button>
        </div>

        <div className="p-5">
          <p id="delete-confirmation-description" className="text-sm font-semibold leading-6 text-slate-600">
            You are about to delete:
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-black text-fuel-ink">{itemName}</p>
            {isSchedule && <p className="mt-1 text-xs font-bold text-slate-500">{frequencyLabel(target.item.weekdays)} · {target.item.weekdays.map(dayShort).join(", ")}</p>}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-bold leading-5 text-amber-900">
              {isSchedule
                ? "Future uncompleted tasks created by this plan will be removed. Completed order history will be kept."
                : "This task will be permanently removed and cannot be restored."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-4">
          <button ref={cancelRef} type="button" disabled={deleting} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-wait disabled:opacity-60"><Trash2 size={17} /> {deleting ? "Deleting..." : isSchedule ? "Delete plan" : "Delete task"}</button>
        </div>
      </section>
    </div>
  );
}

function ThisWeek({ activeTasks, doneTasks, goTo, onOpenOrder, onUpdate, orderSummary, today, weekStart }) {
  const overdue = activeTasks.filter((task) => task.dueDate < today);
  const groups = [
    ...(overdue.length ? [{ key: "overdue", label: "Overdue", date: "Needs attention", tasks: overdue }] : []),
    ...DAYS.map((day, index) => {
      const date = addDays(weekStart, index);
      return {
        key: date,
        label: date === today ? "Today" : day.label,
        date: formatDate(date),
        tasks: activeTasks.filter((task) => task.dueDate === date && task.dueDate >= today)
      };
    }).filter((group) => group.tasks.length)
  ];

  const submittedOrders = orderSummary.filter((order) => order.submissionStatus === "submitted");

  if (!groups.length && !doneTasks.length && !submittedOrders.length) {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={38} />
        <h3 className="mt-3 text-xl font-black">This week is clear</h3>
        <p className="mt-1 font-semibold text-slate-500">Add ordering days in Order plans and they will appear here automatically.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {submittedOrders.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-wide text-amber-700">Order totals</p><h3 className="mt-1 text-lg font-black">This week</h3></div>
            <p className="text-2xl font-black text-fuel-ink">{formatCurrency(submittedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {submittedOrders.map((order) => (
              <div key={order.taskId} className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                <p className="text-xs font-bold text-slate-500">{order.supplier ? `${order.supplier} · ` : ""}{order.orderName}</p>
                <p className="mt-0.5 font-black text-fuel-ink">{formatCurrency(order.total)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {groups.map((group) => (
        <section key={group.key} className={`overflow-hidden rounded-xl border bg-white shadow-sm ${group.key === "overdue" ? "border-red-200" : "border-fuel-line"}`}>
          <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${group.key === "overdue" ? "border-red-100 bg-red-50" : "border-fuel-line bg-slate-50/70"}`}>
            <h3 className={`font-black ${group.key === "overdue" ? "text-red-700" : "text-fuel-ink"}`}>{group.label}</h3>
            <span className="text-xs font-bold text-slate-500">{group.date} · {group.tasks.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {group.tasks.map((task) => <WorkRow key={task.id} goTo={goTo} onOpenOrder={onOpenOrder} onUpdate={onUpdate} task={task} />)}
          </div>
        </section>
      ))}
      {doneTasks.length > 0 && (
        <details className="rounded-xl border border-fuel-line bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 font-black text-emerald-700 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={18} /> Completed this week ({doneTasks.length})</span>
          </summary>
          <div className="divide-y divide-slate-100 border-t border-fuel-line">
            {doneTasks.map((task) => <WorkRow key={task.id} goTo={goTo} onOpenOrder={onOpenOrder} onUpdate={onUpdate} task={task} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function WorkRow({ goTo, onOpenOrder, onUpdate, task }) {
  const isGas = task.taskType === "gas_stock_count";
  const isOrder = task.taskType === "recurring_order";
  const Icon = isGas ? PackageCheck : isOrder ? ShoppingCart : ClipboardList;
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isGas ? "bg-blue-50 text-blue-700" : isOrder ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
        <Icon size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-black ${task.status === "done" ? "text-slate-400 line-through" : "text-fuel-ink"}`}>{task.title}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
            {isGas ? "Stock count" : isOrder ? "Order" : "Task"}
          </span>
        </div>
        {task.description && <p className="mt-1 text-sm font-semibold text-slate-500">{task.description}</p>}
        {task.assignedStaffName && <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-500"><UserRound size={13} /> {task.assignedStaffName}</p>}
      </div>
      {isGas && task.status !== "done" ? (
        <button type="button" onClick={() => goTo?.("gas-stock")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-fuel-green px-4 text-sm font-black text-white">
          Open count <ChevronRight size={17} />
        </button>
      ) : isOrder ? (
        <button type="button" onClick={() => onOpenOrder?.(task)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${task.status === "done" ? "bg-slate-100 text-slate-700" : "bg-amber-500 text-white"}`}>
          {task.status === "done" ? "View order" : "Open order"} <ChevronRight size={17} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onUpdate(task, { status: task.status === "done" ? "todo" : "done" })}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${task.status === "done" ? "bg-slate-100 text-slate-600" : "bg-emerald-600 text-white"}`}
        >
          <Check size={17} /> {task.status === "done" ? "Reopen" : "Complete"}
        </button>
      )}
    </div>
  );
}

function OrderPlans(props) {
  const { editPlan, editingPlanId, isAdmin, onCancel, onDelete, onNew, plan, saving, schedules, setPlan, showPlanForm, staff, submitPlan } = props;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Recurring orders</h2>
            <p className="text-sm font-semibold text-slate-500">Select the actual ordering days. The number of selected days is the weekly frequency.</p>
          </div>
          {isAdmin && <button className={primaryButton} onClick={() => onNew()}><Plus size={18} /> Add plan</button>}
        </div>

        {schedules.length === 0 ? (
          <Card>
            <ShoppingCart className="text-amber-600" size={30} />
            <h3 className="mt-3 text-lg font-black">Set up your regular suppliers</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Start with a category, choose its one, two or three ordering days, and assign someone if needed.</p>
          </Card>
        ) : schedules.map((schedule) => (
          <article key={schedule.id} className={`rounded-xl border bg-white p-4 shadow-sm ${schedule.active ? "border-fuel-line" : "border-slate-200 opacity-65"}`}>
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><ShoppingCart size={21} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black">{schedule.name}</h3>
                  {!schedule.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">Paused</span>}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {frequencyLabel(schedule.weekdays)} · {schedule.weekdays.map(dayShort).join(", ")}
                  {schedule.supplier ? ` · ${schedule.supplier}` : ""}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">{schedule.departments.join(" · ")}</p>
                {schedule.assignedStaffName && <p className="mt-2 text-xs font-bold text-slate-500">Owner: {schedule.assignedStaffName}</p>}
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button aria-label={`Edit ${schedule.name}`} className="grid h-9 w-9 place-items-center rounded-lg bg-fuel-mist text-fuel-green" onClick={() => editPlan(schedule)}><Pencil size={16} /></button>
                  <button aria-label={`Delete ${schedule.name}`} className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-700" onClick={() => onDelete(schedule)}><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <aside className="space-y-4">
        {isAdmin && showPlanForm ? (
          <Card>
            <form className="space-y-4" onSubmit={submitPlan}>
              <div><h3 className="text-lg font-black">{editingPlanId ? "Edit order plan" : "New order plan"}</h3><p className="text-sm font-semibold text-slate-500">No extra menu item will be created.</p></div>
              <Field label="Order category">
                <input required className={inputClass} placeholder="e.g. Vape" value={plan.name} onChange={(event) => setPlan({ ...plan, name: event.target.value })} />
              </Field>
              <Field label="Supplier (optional)">
                <input className={inputClass} placeholder="Supplier name" value={plan.supplier} onChange={(event) => setPlan({ ...plan, supplier: event.target.value })} />
              </Field>
              <Field label="Ordering days">
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map((day) => {
                    const selected = plan.weekdays.includes(day.value);
                    return <button key={day.value} type="button" onClick={() => setPlan({ ...plan, weekdays: selected ? plan.weekdays.filter((value) => value !== day.value) : [...plan.weekdays, day.value] })} className={`rounded-lg border px-2 py-2 text-xs font-black ${selected ? "border-fuel-green bg-fuel-green text-white" : "border-fuel-line bg-white text-slate-600"}`}>{day.short}</button>;
                  })}
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">{plan.weekdays.length ? frequencyLabel(plan.weekdays) : "Choose at least one day"}</p>
              </Field>
              <Field label="Order value sections">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlan({ ...plan, departments: ["Total order"] })}
                    className={`rounded-lg border px-3 py-2 text-sm font-black ${plan.departments.length === 1 && plan.departments[0] === "Total order" ? "border-fuel-green bg-fuel-green text-white" : "border-fuel-line text-slate-600"}`}
                  >
                    Single total
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlan({ ...plan, departments: MORRISONS_DEPARTMENTS })}
                    className={`rounded-lg border px-3 py-2 text-sm font-black ${MORRISONS_DEPARTMENTS.every((name) => plan.departments.includes(name)) ? "border-fuel-green bg-fuel-green text-white" : "border-fuel-line text-slate-600"}`}
                  >
                    Morrisons 4 sections
                  </button>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">{plan.departments.join(" · ")}</p>
              </Field>
              <Field label="Assign to (optional)">
                <select className={inputClass} value={plan.assignedStaffId} onChange={(event) => setPlan({ ...plan, assignedStaffId: event.target.value })}>
                  <option value="">Anyone</option>
                  {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <textarea className={`${inputClass} min-h-20`} placeholder="Cut-off time, portal or checklist" value={plan.notes} onChange={(event) => setPlan({ ...plan, notes: event.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={plan.active} onChange={(event) => setPlan({ ...plan, active: event.target.checked })} /> Active</label>
              <div className="flex gap-2"><button disabled={saving} className={`${primaryButton} flex-1`}>{saving ? "Saving..." : editingPlanId ? "Save changes" : "Create plan"}</button><button type="button" onClick={onCancel} className="rounded-lg bg-slate-100 px-4 font-black text-slate-600">Cancel</button></div>
            </form>
          </Card>
        ) : isAdmin ? (
          <Card>
            <h3 className="font-black">Suggested categories</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Use only the ones your station needs.</p>
            <div className="mt-3 space-y-2">
              {SUGGESTED_ORDERS.filter((preset) => !schedules.some((schedule) => schedule.name.toLowerCase() === preset.name.toLowerCase() && (schedule.supplier || "").toLowerCase() === preset.supplier.toLowerCase())).map((preset) => (
                <button key={`${preset.supplier}-${preset.name}`} onClick={() => onNew(preset)} className="flex w-full items-center justify-between rounded-lg border border-fuel-line px-3 py-2 text-left text-sm font-black hover:bg-fuel-mist"><span>{preset.supplier ? `${preset.supplier} — ` : ""}{preset.name}</span><Plus size={16} /></button>
              ))}
            </div>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function OrderEntry({ onBack, onSaved, task }) {
  const [viewData, setViewData] = React.useState(null);
  const [form, setForm] = React.useState({ amounts: {}, reference: "", notes: "" });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    api.workOrder(task.id)
      .then((data) => {
        setViewData(data);
        setForm({
          amounts: Object.fromEntries(data.schedule.departments.map((department) => [department, data.submission.amounts[department] || ""])),
          reference: data.submission.reference || "",
          notes: data.submission.notes || ""
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [task.id]);

  const total = Object.values(form.amounts).reduce((sum, value) => {
    const amount = Number(value);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const save = async (submit) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = submit
        ? await api.submitWorkOrder(task.id, form)
        : await api.saveWorkOrderDraft(task.id, form);
      setViewData(saved);
      setForm({
        amounts: Object.fromEntries(saved.schedule.departments.map((department) => [department, saved.submission.amounts[department] || ""])),
        reference: saved.submission.reference || "",
        notes: saved.submission.notes || ""
      });
      onSaved(saved);
      setMessage(submit ? "Order submitted and task completed." : "Draft saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-fuel-green shadow-sm"><ArrowLeft size={17} /> Back to Work</button>
      <PageHeader
        eyebrow={viewData?.schedule?.supplier || "Supplier order"}
        title={viewData?.schedule?.name || task.title.replace(/^Order\s+—\s+/, "")}
        description="Enter the order value for each section. The total is calculated automatically."
        meta={<Pill tone={viewData?.submission?.status === "submitted" ? "green" : "amber"}>{viewData?.submission?.status === "submitted" ? "Submitted" : viewData?.submission?.status === "draft" ? "Draft" : "Not started"}</Pill>}
      />

      <Status loading={loading} error={error} empty={false}>
        {viewData && (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card>
              <div className="flex items-center gap-3 border-b border-fuel-line pb-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><PoundSterling size={22} /></span>
                <div><h2 className="text-xl font-black">Order values</h2><p className="text-sm font-semibold text-slate-500">Due {formatDate(viewData.task.dueDate)}</p></div>
              </div>
              <div className="mt-4 space-y-3">
                {viewData.schedule.departments.map((department) => (
                  <label key={department} className="grid gap-2 rounded-xl border border-fuel-line bg-slate-50 p-3 sm:grid-cols-[1fr_190px] sm:items-center">
                    <span className="font-black text-fuel-ink">{department}</span>
                    <span className="flex min-h-12 items-center rounded-lg border border-fuel-line bg-white px-3 focus-within:border-fuel-green focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="font-black text-slate-400">£</span>
                      <input
                        aria-label={`${department} order value`}
                        className="min-w-0 flex-1 border-0 bg-transparent px-2 text-right text-lg font-black outline-none"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        type="number"
                        value={form.amounts[department] ?? ""}
                        onChange={(event) => setForm({ ...form, amounts: { ...form.amounts, [department]: event.target.value } })}
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-fuel-deep px-4 py-4 text-white">
                <span className="text-sm font-black uppercase tracking-wide text-blue-100">Order total</span>
                <span className="text-2xl font-black">{formatCurrency(total)}</span>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <h3 className="font-black">Order details</h3>
                <div className="mt-4 space-y-4">
                  <Field label="Order/reference number"><input className={inputClass} placeholder="Optional" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></Field>
                  <Field label="Notes"><textarea className={`${inputClass} min-h-24`} placeholder="Optional note" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
                </div>
                {viewData.submission.submittedAt && (
                  <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                    Submitted by {viewData.submission.submittedByUsername || "staff"} on {formatDateTime(viewData.submission.submittedAt)}
                  </div>
                )}
                {message && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
                {!viewData.canEdit && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">This order is assigned to {viewData.task.assignedStaffName}.</p>}
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <button type="button" disabled={saving || !viewData.canEdit} onClick={() => save(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fuel-mist px-4 font-black text-fuel-green disabled:opacity-50"><Save size={18} /> Save draft</button>
                  <button type="button" disabled={saving || !viewData.canEdit} onClick={() => save(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-black text-white disabled:opacity-50"><Send size={18} /> {saving ? "Saving..." : "Submit order"}</button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </Status>
    </div>
  );
}

function OtherTasks({ currentUser, form, isAdmin, onCreate, onDelete, onUpdate, saving, setForm, staff, tasks }) {
  const assignable = isAdmin ? staff : staff.filter((person) => String(person.id) === String(currentUser?.staffId));
  return (
    <div className="space-y-4">
      <Card>
        <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" onSubmit={onCreate}>
          <Field label="One-off task"><input required className={inputClass} placeholder="e.g. Check pump receipt rolls" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="Due date"><input type="date" className={inputClass} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
          <Field label="Assign"><select className={inputClass} value={form.assignedStaffId} onChange={(event) => setForm({ ...form, assignedStaffId: event.target.value })}><option value="">Anyone</option>{assignable.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
          <button disabled={saving} className={`${primaryButton} self-end`}><Plus size={18} /> Add task</button>
        </form>
      </Card>
      <section className="overflow-hidden rounded-xl border border-fuel-line bg-white shadow-sm">
        <div className="border-b border-fuel-line bg-slate-50 px-4 py-3"><h3 className="font-black">Other shop tasks</h3></div>
        {tasks.length ? <div className="divide-y divide-slate-100">{tasks.map((task) => (
          <div key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <button onClick={() => onUpdate(task, { status: task.status === "done" ? "todo" : "done" })} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${task.status === "done" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent"}`}><Check size={16} /></button>
            <div className="min-w-0 flex-1"><p className={`font-black ${task.status === "done" ? "text-slate-400 line-through" : ""}`}>{task.title}</p><p className="text-xs font-bold text-slate-500">{formatDate(task.dueDate)}{task.assignedStaffName ? ` · ${task.assignedStaffName}` : " · Anyone"}</p></div>
            {isAdmin && <button className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-700" onClick={() => onDelete(task)}><Trash2 size={16} /></button>}
          </div>
        ))}</div> : <p className="p-6 text-center font-semibold text-slate-500">No one-off tasks yet.</p>}
      </section>
    </div>
  );
}

function Metric({ label, tone, value }) {
  const tones = { blue: "bg-blue-50 text-blue-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700", slate: "bg-slate-100 text-slate-600" };
  return <div className="rounded-xl border border-fuel-line bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 inline-flex min-w-10 justify-center rounded-lg px-2.5 py-1 text-xl font-black ${tones[tone]}`}>{value}</p></div>;
}

function ViewButton({ active, icon: Icon, label, onClick }) {
  return <button type="button" onClick={onClick} className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition ${active ? "bg-fuel-green text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={17} /> {label}</button>;
}

function frequencyLabel(weekdays = []) {
  const count = weekdays.length;
  if (count === 1) return "Once weekly";
  if (count === 2) return "Twice weekly";
  if (count === 3) return "3 times weekly";
  return `${count} times weekly`;
}

function dayShort(value) {
  return DAYS.find((day) => day.value === Number(value))?.short || "";
}

function mondayFor(value) {
  const date = new Date(`${value}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateInputValue(date);
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toDateInputValue(date);
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${value}T00:00:00`));
}

function formatWeek(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value) || 0);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
