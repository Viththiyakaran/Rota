import React from "react";
import { CheckCircle2, GripVertical, ListChecks, Plus, Trash2 } from "lucide-react";
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
  const [error, setError] = React.useState("");

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
              {staff.map((person) => (
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
                  <h3 className="text-lg font-black">{column.label}</h3>
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
                        <span className="rounded-md bg-fuel-mist px-2 py-1 text-xs font-black text-fuel-green">
                          {task.assignedStaffName || "Anyone"}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                          {task.createdByUsername || currentUser?.username || "System"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {COLUMNS.filter((item) => item.id !== task.status).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="rounded-md bg-fuel-mist px-2 py-1 text-xs font-black text-fuel-green"
                            onClick={() => moveTask(task.id, item.id)}
                          >
                            {item.label}
                          </button>
                        ))}
                        {task.status === "done" && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                            <CheckCircle2 size={14} />
                            Complete
                          </span>
                        )}
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700"
                          onClick={() => removeTask(task.id)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
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
