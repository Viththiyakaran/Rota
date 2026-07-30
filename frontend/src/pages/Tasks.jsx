import React from "react";
import { AtSign, CheckCircle2, ChevronDown, GripVertical, ListChecks, Plus, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";
import { PageHeader, Pill, primaryButton } from "../components/PageHeader.jsx";
import { Status } from "../components/Status.jsx";
import { toDateInputValue } from "../dateUtils.js";

const COLUMNS = [
  { id: "backlog", label: "Backlog", tone: "bg-slate-100 text-slate-700" },
  { id: "todo", label: "To do", tone: "bg-fuel-mist text-fuel-green" },
  { id: "process", label: "Doing", tone: "bg-amber-50 text-amber-800" },
  { id: "done", label: "Done", tone: "bg-emerald-50 text-emerald-700" }
];

export function Tasks({ currentUser }) {
  const today = React.useMemo(() => toDateInputValue(new Date()), []);
  const [tasks, setTasks] = React.useState([]);
  const [staff, setStaff] = React.useState([]);
  const [form, setForm] = React.useState({ title: "", description: "", dueDate: today, assignedStaffId: "", status: "todo" });
  const [draggingId, setDraggingId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savingAssignmentId, setSavingAssignmentId] = React.useState(null);
  const [error, setError] = React.useState("");
  const isAdmin = currentUser?.role === "admin";
  const assignableStaff = isAdmin
    ? staff
    : staff.filter((person) => String(person.id) === String(currentUser?.staffId));

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([api.tasks(), api.staff()])
      .then(([taskRows, staffRows]) => {
        setTasks(taskRows);
        setStaff(staffRows.filter((person) => person.active));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const createTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const task = await api.createTask({
        ...form,
        assignedStaffId: form.assignedStaffId || null
      });
      setTasks((current) => [task, ...current]);
      setForm({ title: "", description: "", dueDate: today, assignedStaffId: "", status: "todo" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (taskId, status) => {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    if (!task || task.status === status) return;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try {
      const saved = await api.updateTask(task.id, { status });
      setTasks((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const assignTask = async (taskId, assignedStaffId) => {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    if (!task || String(task.assignedStaffId || "") === String(assignedStaffId || "")) return;

    setSavingAssignmentId(task.id);
    setError("");
    try {
      const saved = await api.updateTask(task.id, { assignedStaffId: assignedStaffId || null });
      setTasks((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setSavingAssignmentId(null);
    }
  };

  const removeTask = async (taskId) => {
    const previous = tasks;
    setTasks((current) => current.filter((item) => item.id !== taskId));
    try {
      await api.deleteTask(taskId);
    } catch (err) {
      setError(err.message);
      setTasks(previous);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Shared Work"
        title="Task Board"
        description="Track shop jobs, admin follow-ups, and handover tasks from backlog to done."
        meta={(
          <Pill>
            <ListChecks size={18} />
            {tasks.length} tasks
          </Pill>
        )}
      />

      <Card>
        <form className="grid gap-3 lg:grid-cols-[1.2fr_1.4fr_0.9fr_1fr_0.8fr_auto]" onSubmit={createTask}>
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700 lg:col-span-6">{error}</p>}
          <Field label="Task">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. Check pump receipt rolls"
            />
          </Field>
          <Field label="Details">
            <input
              className={inputClass}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Short note"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
            />
          </Field>
          <Field label="Assign">
            <select className={inputClass} value={form.assignedStaffId} onChange={(event) => setForm({ ...form, assignedStaffId: event.target.value })}>
              <option value="">Anyone</option>
              {assignableStaff.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {COLUMNS.map((column) => (
                <option key={column.id} value={column.id}>{column.label}</option>
              ))}
            </select>
          </Field>
          <button className={`${primaryButton} self-end`} disabled={saving}>
            <Plus size={18} />
            Add
          </button>
        </form>
      </Card>

      <Status loading={loading} error="" empty={tasks.length === 0}>
        <div className="grid gap-4 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.id);
            return (
              <section
                key={column.id}
                className="min-h-72 rounded-lg border border-fuel-line bg-white/90 p-3 shadow-sm"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("text/plain") || draggingId;
                  setDraggingId(null);
                  if (taskId) moveTask(taskId, column.id);
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black">{column.label}</h3>
                    {column.id === "done" ? (
                      <p className="text-xs font-bold text-slate-500">Visible here for 24 hours</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${column.tone}`}>{columnTasks.length}</span>
                </div>

                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggingId(task.id);
                        event.dataTransfer.setData("text/plain", String(task.id));
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`rounded-md border border-fuel-line bg-white p-3 shadow-sm transition ${draggingId === task.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black">{task.title}</p>
                          {task.description && <p className="mt-1 text-sm font-bold text-slate-600">{task.description}</p>}
                        </div>
                        <GripVertical className="shrink-0 text-slate-400" size={18} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {task.dueDate && (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                            {task.dueDate}
                          </span>
                        )}
                        {task.status === "done" && task.completedAt ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                            Completed {formatCompletedTime(task.completedAt)}
                          </span>
                        ) : null}
                        <TaskAssignee
                          currentUser={currentUser}
                          isAdmin={isAdmin}
                          onAssign={assignTask}
                          saving={savingAssignmentId === task.id}
                          staff={staff}
                          task={task}
                        />
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                          Created by {task.createdByUsername || currentUser?.username || "System"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        <label className="flex items-center gap-2 text-xs font-black text-slate-500">
                          <span>Move to</span>
                          <select
                            aria-label={`Move ${task.title}`}
                            className="rounded-md border border-fuel-line bg-fuel-mist px-2 py-1.5 text-xs font-black text-fuel-green outline-none focus:border-fuel-green"
                            value={task.status}
                            onChange={(event) => moveTask(task.id, event.target.value)}
                          >
                            {COLUMNS.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                        {task.status === "done" && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                            <CheckCircle2 size={14} />
                            Complete
                          </span>
                        )}
                        {isAdmin ? (
                          <button
                            type="button"
                            className="ml-auto inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700"
                            onClick={() => {
                              if (window.confirm(`Delete "${task.title}"?`)) removeTask(task.id);
                            }}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="rounded-lg border border-dashed border-fuel-line bg-fuel-mist/40 p-4 text-center text-sm font-bold text-slate-500">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </Status>
    </div>
  );
}

function TaskAssignee({ currentUser, isAdmin, onAssign, saving, staff, task }) {
  const assignedToCurrentUser =
    task.assignedStaffId &&
    String(task.assignedStaffId) === String(currentUser?.staffId);

  if (isAdmin) {
    return (
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md bg-fuel-mist px-2 py-1 text-xs font-black text-fuel-green hover:bg-fuel-line [&::-webkit-details-marker]:hidden">
          <AtSign size={13} />
          {saving ? "Assigning..." : task.assignedStaffName || "Assign"}
          <ChevronDown size={13} className="transition group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 top-8 z-30 w-52 rounded-lg border border-fuel-line bg-white p-2 shadow-xl">
          <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">Assign task</p>
          {[{ id: "", name: "Anyone" }, ...staff].map((person) => {
            const selected = String(task.assignedStaffId || "") === String(person.id || "");
            return (
              <button
                key={person.id || "anyone"}
                type="button"
                disabled={saving || selected}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-bold ${
                  selected ? "bg-fuel-mist text-fuel-green" : "text-slate-700 hover:bg-slate-50"
                }`}
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onAssign(task.id, person.id);
                }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[11px] font-black text-fuel-green">
                  {person.id ? String(person.name).charAt(0).toUpperCase() : <AtSign size={12} />}
                </span>
                {person.name}
                {selected ? <span className="ml-auto text-xs">Selected</span> : null}
              </button>
            );
          })}
        </div>
      </details>
    );
  }

  if (!task.assignedStaffId) {
    return (
      <button
        type="button"
        disabled={saving || !currentUser?.staffId}
        onClick={() => onAssign(task.id, currentUser.staffId)}
        className="inline-flex items-center gap-1 rounded-md bg-fuel-green px-2 py-1 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <AtSign size={13} />
        {saving ? "Assigning..." : "Assign to me"}
      </button>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${
      assignedToCurrentUser ? "bg-emerald-50 text-emerald-700" : "bg-fuel-mist text-fuel-green"
    }`}>
      <AtSign size={13} />
      {assignedToCurrentUser ? "Assigned to you" : task.assignedStaffName || "Assigned"}
    </span>
  );
}

function formatCompletedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
