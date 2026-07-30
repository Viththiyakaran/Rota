import React from "react";
import { Archive, CalendarDays, ClipboardCheck, Clock, FileText, RotateCcw, Trash2, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDateLabel, formatDayLabel, getMonday, toDateInputValue } from "../dateUtils.js";

export function Reports({ goTo }) {
  const [period, setPeriod] = React.useState("this-week");
  const [data, setData] = React.useState({ staff: [], shifts: [], timeOff: [], tasks: [], completedTasks: [], audit: [] });
  const [loading, setLoading] = React.useState(true);
  const [workingTaskId, setWorkingTaskId] = React.useState(null);
  const [error, setError] = React.useState("");

  const range = React.useMemo(() => getReportRange(period), [period]);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.staff(),
      api.week(range.start),
      api.timeOff(),
      api.tasks(),
      api.completedTasks(),
      api.audit()
    ])
      .then(([staffResult, shiftResult, timeOffResult, taskResult, completedTaskResult, auditResult]) => {
        setData({
          staff: staffResult.status === "fulfilled" ? staffResult.value : [],
          shifts: shiftResult.status === "fulfilled" ? shiftResult.value : [],
          timeOff: timeOffResult.status === "fulfilled" ? timeOffResult.value : [],
          tasks: taskResult.status === "fulfilled" ? taskResult.value : [],
          completedTasks: completedTaskResult.status === "fulfilled" ? completedTaskResult.value : [],
          audit: auditResult.status === "fulfilled" ? auditResult.value : []
        });
        const failed = [staffResult, shiftResult, timeOffResult, taskResult, completedTaskResult, auditResult]
          .find((result) => result.status === "rejected");
        if (failed) setError(failed.reason.message);
      })
      .finally(() => setLoading(false));
  }, [range.start]);

  const periodShifts = data.shifts.filter((shift) => shift.shiftDate >= range.start && shift.shiftDate <= range.end);
  const staffHours = buildStaffHours(data.staff, periodShifts);
  const periodTimeOff = data.timeOff.filter((request) => request.startDate <= range.end && request.endDate >= range.start);
  const periodTasks = data.tasks.filter((task) => task.dueDate >= range.start && task.dueDate <= range.end);
  const openTasks = periodTasks.filter((task) => task.status !== "done");
  const periodCompletedTasks = data.completedTasks.filter((task) => {
    const completedDate = task.completedAt ? toDateInputValue(new Date(task.completedAt)) : "";
    return completedDate >= range.start && completedDate <= range.end;
  });
  const recentAudit = data.audit.slice(0, 8);

  const restoreTask = async (task) => {
    setWorkingTaskId(task.id);
    setError("");
    try {
      const restored = await api.updateTask(task.id, { status: "todo" });
      setData((current) => ({
        ...current,
        tasks: [restored, ...current.tasks.filter((item) => item.id !== task.id)],
        completedTasks: current.completedTasks.filter((item) => item.id !== task.id)
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setWorkingTaskId(null);
    }
  };

  const deleteCompletedTask = async (task) => {
    if (!window.confirm(`Permanently delete "${task.title}"?`)) return;
    setWorkingTaskId(task.id);
    setError("");
    try {
      await api.deleteTask(task.id);
      setData((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== task.id),
        completedTasks: current.completedTasks.filter((item) => item.id !== task.id)
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setWorkingTaskId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuel-green">Admin reports</p>
            <h1 className="mt-2 text-3xl font-black text-fuel-ink">Reports</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Simple rota, staff hours, time off and task summaries.</p>
          </div>
          <select
            className="min-h-11 rounded-lg border border-fuel-line bg-white px-3 text-sm font-bold text-fuel-ink"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="this-week">This week</option>
            <option value="last-week">Last week</option>
            <option value="this-month">This month</option>
          </select>
        </div>
        <p className="mt-3 text-sm font-bold text-slate-500">{formatDateLabel(range.start)} to {formatDateLabel(range.end)}</p>
      </Card>

      <Status loading={loading} error={error}>
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard icon={CalendarDays} title="Weekly Rota Report" action="Open rota" onAction={() => goTo("rota")}>
            <MetricRow label="Total shifts" value={periodShifts.length} />
            <MetricRow label="Paid hours" value={formatHours(sumHours(periodShifts))} />
            <MetricRow label="Busiest day" value={getBusiestDay(periodShifts) || "No shifts"} />
          </ReportCard>

          <ReportCard icon={Users} title="Staff Hours Report">
            {staffHours.length ? staffHours.map((row) => (
              <MetricRow key={row.id} label={row.name} value={`${formatHours(row.hours)} · ${row.shifts} shifts`} />
            )) : <EmptyLine />}
          </ReportCard>

          <ReportCard icon={Clock} title="Time Off Report" action="Open time off" onAction={() => goTo("time-off")}>
            {periodTimeOff.length ? periodTimeOff.slice(0, 6).map((request) => (
              <MetricRow key={request.id} label={`${request.staffName} · ${request.status}`} value={`${formatDayLabel(request.startDate)} - ${formatDayLabel(request.endDate)}`} />
            )) : <EmptyLine />}
          </ReportCard>

          <ReportCard icon={ClipboardCheck} title="Task Completion Report" action="Open tasks" onAction={() => goTo("tasks")}>
            <MetricRow label="Completed" value={periodCompletedTasks.length} />
            <MetricRow label="Archived from board" value={periodCompletedTasks.filter((task) => task.archived).length} />
            <MetricRow label="Still open" value={openTasks.length} />
          </ReportCard>
        </div>

        <ReportCard icon={Archive} title="Completed Task History">
          {periodCompletedTasks.length ? periodCompletedTasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-fuel-ink">{task.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    task.archived ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {task.archived ? "Archived" : "On board"}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {task.assignedStaffName || "Anyone"} · Completed {formatCompletedDate(task.completedAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={workingTaskId === task.id}
                  onClick={() => restoreTask(task)}
                  className="inline-flex items-center gap-1 rounded-md bg-fuel-mist px-3 py-2 text-xs font-black text-fuel-green disabled:opacity-60"
                >
                  <RotateCcw size={14} />
                  Restore
                </button>
                <button
                  type="button"
                  disabled={workingTaskId === task.id}
                  onClick={() => deleteCompletedTask(task)}
                  className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          )) : <EmptyLine />}
        </ReportCard>

        <ReportCard icon={FileText} title="Audit Log Report">
          {recentAudit.length ? recentAudit.map((entry) => (
            <MetricRow key={entry.id} label={entry.action || "Change"} value={entry.details || entry.username || "Recorded"} />
          )) : <EmptyLine />}
        </ReportCard>
      </Status>
    </div>
  );
}

function ReportCard({ action, children, icon: Icon, onAction, title }) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
            <Icon size={20} />
          </span>
          <h2 className="text-lg font-black text-fuel-ink">{title}</h2>
        </div>
        {action && (
          <button className="rounded-md bg-fuel-mist px-3 py-2 text-sm font-black text-fuel-green" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="min-w-0 truncate text-sm font-bold text-slate-600">{label}</span>
      <span className="shrink-0 text-sm font-black text-fuel-ink">{value}</span>
    </div>
  );
}

function EmptyLine() {
  return <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">No data available for this period.</p>;
}

function getReportRange(period) {
  const now = new Date();
  if (period === "last-week") {
    const start = addDays(getMonday(now), -7);
    return { start: toDateInputValue(start), end: toDateInputValue(addDays(start, 6)) };
  }
  if (period === "this-month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toDateInputValue(start), end: toDateInputValue(end) };
  }
  const start = getMonday(now);
  return { start: toDateInputValue(start), end: toDateInputValue(addDays(start, 6)) };
}

function buildStaffHours(staff, shifts) {
  return staff
    .map((person) => {
      const rows = shifts.filter((shift) => String(shift.staffId) === String(person.id));
      return {
        id: person.id,
        name: person.name,
        shifts: rows.length,
        hours: sumHours(rows)
      };
    })
    .filter((row) => row.shifts > 0)
    .sort((left, right) => right.hours - left.hours);
}

function sumHours(shifts) {
  return shifts.reduce((total, shift) => total + Number(shift.paidHours || 0), 0);
}

function formatHours(value) {
  return Number(value || 0).toFixed(Number.isInteger(Number(value || 0)) ? 0 : 2);
}

function formatCompletedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getBusiestDay(shifts) {
  const counts = shifts.reduce((map, shift) => {
    map.set(shift.shiftDate, (map.get(shift.shiftDate) || 0) + 1);
    return map;
  }, new Map());
  const [date] = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] || [];
  return date ? formatDayLabel(date) : "";
}
