import React from "react";
import { Activity, Archive, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Clock, FileText, Minus, PackageCheck, Percent, PoundSterling, RotateCcw, Save, ShoppingCart, Trash2, TrendingUp, Users } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Status } from "../components/Status.jsx";
import { addDays, formatDateLabel, formatDayLabel, getMonday, toDateInputValue } from "../dateUtils.js";

export function Reports({ goTo }) {
  const [period, setPeriod] = React.useState("this-week");
  const [data, setData] = React.useState({ staff: [], shifts: [], timeOff: [], tasks: [], completedTasks: [], audit: [], sales: [], orders: [] });
  const [loading, setLoading] = React.useState(true);
  const [workingTaskId, setWorkingTaskId] = React.useState(null);
  const [error, setError] = React.useState("");

  const range = React.useMemo(() => getReportRange(period), [period]);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    const shiftRanges = getRangeChunks(range.start, range.end);
    const previousRange = getPreviousRange(range);
    const orderWeeks = [...new Set(shiftRanges)];
    Promise.allSettled([
      api.staff(),
      Promise.all(shiftRanges.map((start) => api.week(start))),
      api.timeOff(),
      api.tasks(),
      api.completedTasks(),
      api.audit(),
      api.sales(previousRange.start, range.end),
      Promise.all(orderWeeks.map((weekStart) => api.workOrderSummary(weekStart)))
    ])
      .then(([staffResult, shiftResult, timeOffResult, taskResult, completedTaskResult, auditResult, salesResult, orderResult]) => {
        setData({
          staff: staffResult.status === "fulfilled" ? staffResult.value : [],
          shifts: shiftResult.status === "fulfilled" ? uniqueRows(shiftResult.value.flat()) : [],
          timeOff: timeOffResult.status === "fulfilled" ? timeOffResult.value : [],
          tasks: taskResult.status === "fulfilled" ? taskResult.value : [],
          completedTasks: completedTaskResult.status === "fulfilled" ? completedTaskResult.value : [],
          audit: auditResult.status === "fulfilled" ? auditResult.value : [],
          sales: salesResult.status === "fulfilled" ? salesResult.value : [],
          orders: orderResult.status === "fulfilled" ? uniqueRowsBy(orderResult.value.flat(), "taskId") : []
        });
        const failed = [staffResult, shiftResult, timeOffResult, taskResult, completedTaskResult, auditResult, salesResult, orderResult]
          .find((result) => result.status === "rejected");
        if (failed) setError(failed.reason.message);
      })
      .finally(() => setLoading(false));
  }, [range.start, range.end]);

  const periodShifts = data.shifts.filter((shift) => shift.shiftDate >= range.start && shift.shiftDate <= range.end);
  const staffHours = buildStaffHours(data.staff, periodShifts);
  const periodTimeOff = data.timeOff.filter((request) => request.startDate <= range.end && request.endDate >= range.start);
  const periodTasks = uniqueRowsBy([...data.tasks, ...data.completedTasks], "id")
    .filter((task) => task.dueDate >= range.start && task.dueDate <= range.end);
  const openTasks = periodTasks.filter((task) => task.status !== "done");
  const completedDueTasks = periodTasks.filter((task) => task.status === "done");
  const periodCompletedTasks = data.completedTasks.filter((task) => {
    const completedDate = task.completedAt ? toDateInputValue(new Date(task.completedAt)) : "";
    return completedDate >= range.start && completedDate <= range.end;
  });
  const recentAudit = data.audit.filter((entry) => {
    const entryDate = entry.createdAt ? toDateInputValue(new Date(entry.createdAt)) : "";
    return entryDate >= range.start && entryDate <= range.end;
  }).slice(0, 8);
  const previousRange = getPreviousRange(range);
  const periodSales = data.sales.filter((entry) => entry.saleDate >= range.start && entry.saleDate <= range.end);
  const previousSales = data.sales.filter((entry) => entry.saleDate >= previousRange.start && entry.saleDate <= previousRange.end);
  const periodOrders = data.orders.filter((order) => order.submissionStatus === "submitted" && order.dueDate >= range.start && order.dueDate <= range.end);
  const totalHours = sumHours(periodShifts);
  const scheduledStaff = staffHours.length;
  const taskTotal = periodTasks.length;
  const taskCompletionRate = taskTotal > 0 ? Math.round((completedDueTasks.length / taskTotal) * 100) : 0;
  const hoursTrend = buildHoursTrend(range.start, range.end, periodShifts);

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
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuel-green">Admin reports</p>
            <h1 className="mt-1 text-3xl font-black text-fuel-ink">Business report</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Sales, order value and station operations for the selected period.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm font-bold text-slate-500">{formatDateLabel(range.start)} – {formatDateLabel(range.end)}</p>
            <select
              className="min-h-11 rounded-lg border border-fuel-line bg-white px-3 text-sm font-bold text-fuel-ink outline-none focus:border-fuel-green focus:ring-2 focus:ring-blue-100"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="this-week">This week</option>
              <option value="last-week">Last week</option>
              <option value="this-month">This month</option>
            </select>
          </div>
        </div>
      </Card>

      <Status loading={loading} error={error}>
        <BusinessPerformanceReport
          goTo={goTo}
          orders={periodOrders}
          previousRange={previousRange}
          previousSales={previousSales}
          range={range}
          sales={periodSales}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportKpi
            icon={CalendarDays}
            label="Total shifts"
            value={periodShifts.length}
            helper={getBusiestDay(periodShifts) ? `Busiest: ${getBusiestDay(periodShifts)}` : "No shifts scheduled"}
            tone="blue"
          />
          <ReportKpi
            icon={Clock}
            label="Paid hours"
            value={`${formatHours(totalHours)}h`}
            helper={scheduledStaff ? `${formatHours(totalHours / scheduledStaff)}h average per staff` : "No scheduled hours"}
            tone="indigo"
          />
          <ReportKpi
            icon={Users}
            label="Staff scheduled"
            value={scheduledStaff}
            helper={`${data.staff.filter((person) => person.active).length} active staff`}
            tone="emerald"
          />
          <ReportKpi
            icon={CheckCircle2}
            label="Task completion"
            value={`${taskCompletionRate}%`}
            helper={`${completedDueTasks.length} complete · ${openTasks.length} open`}
            tone="amber"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
          <HoursTrendChart rows={hoursTrend} onOpenRota={() => goTo("rota")} />
          <StaffHoursDonut rows={staffHours} totalHours={totalHours} />
        </div>

        <div className={`grid gap-4 ${periodTimeOff.length ? "lg:grid-cols-2" : ""}`}>
          {periodTimeOff.length > 0 && (
            <ReportCard icon={Clock} title="Time off" action="Manage" onAction={() => goTo("time-off")}>
              {periodTimeOff.slice(0, 5).map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-fuel-ink">{request.staffName}</p>
                  <p className="text-xs font-bold text-slate-500">{formatDayLabel(request.startDate)} – {formatDayLabel(request.endDate)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${
                  request.status === "approved" ? "bg-emerald-100 text-emerald-700" : request.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {request.status}
                </span>
              </div>
              ))}
            </ReportCard>
          )}

          <ReportCard icon={ClipboardCheck} title="Task progress" action="Open tasks" onAction={() => goTo("tasks")}>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black text-fuel-ink">{taskCompletionRate}%</p>
                  <p className="text-xs font-bold text-slate-500">tasks due in this period</p>
                </div>
                <p className="text-sm font-black text-fuel-green">{completedDueTasks.length}/{taskTotal}</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-fuel-green transition-all" style={{ width: `${taskCompletionRate}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="Complete" value={completedDueTasks.length} />
              <MiniMetric label="Open" value={openTasks.length} />
              <MiniMetric label="Archived" value={completedDueTasks.filter((task) => task.archived).length} />
            </div>
          </ReportCard>
        </div>

        {periodCompletedTasks.length > 0 && (
          <ReportCard icon={Archive} title="Completed Task History">
            {periodCompletedTasks.map((task) => (
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
            ))}
          </ReportCard>
        )}

        <ReportCard icon={FileText} title="Audit Log Report">
          {recentAudit.length ? recentAudit.map((entry) => (
            <MetricRow key={entry.id} label={entry.action || "Change"} value={entry.details || entry.username || "Recorded"} />
          )) : <EmptyLine />}
        </ReportCard>
      </Status>
    </div>
  );
}

function BusinessPerformanceReport({ goTo, orders, previousRange, previousSales, range, sales }) {
  const salesTotal = sales.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const orderTotal = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const comparison = buildMatchingSalesComparison(range, previousRange, sales, previousSales);
  const salesChange = percentageChange(comparison.currentTotal, comparison.previousTotal);
  const recordedSalesDates = new Set(sales.map((entry) => entry.saleDate));
  const coveredOrders = orders.filter((order) => recordedSalesDates.has(order.dueDate));
  const coveredOrderTotal = coveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const orderToSales = salesTotal > 0 ? (coveredOrderTotal / salesTotal) * 100 : null;
  const today = toDateInputValue(new Date());
  const isOpenPeriod = range.start <= today && range.end >= today;
  const salesLabel = isOpenPeriod ? "Sales to date" : "Sales";
  const trendRows = buildBusinessTrend(range, sales, orders);
  const maxTrend = Math.max(1, ...trendRows.flatMap((row) => [row.sales, row.orders]));
  const departmentTotals = new Map();
  orders.forEach((order) => {
    Object.entries(order.amounts || {}).forEach(([department, amount]) => {
      const label = department === "Total order"
        ? (order.orderName || order.supplier || "Other order")
        : department;
      departmentTotals.set(label, (departmentTotals.get(label) || 0) + Number(amount || 0));
    });
  });
  const departments = [...departmentTotals.entries()].sort((left, right) => right[1] - left[1]);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BusinessKpi icon={PoundSterling} label={salesLabel} value={formatCurrency(salesTotal)} helper={`${sales.length} recorded day${sales.length === 1 ? "" : "s"}`} />
        <BusinessKpi icon={ShoppingCart} label="Submitted orders" value={formatCurrency(orderTotal)} helper={`${orders.length} order${orders.length === 1 ? "" : "s"} in selected period`} tone="amber" />
        <BusinessKpi icon={Percent} label="Order-to-sales" value={orderToSales === null ? "—" : `${orderToSales.toFixed(1)}%`} helper={`${formatCurrency(coveredOrderTotal)} orders across recorded sales days`} tone="indigo" />
        <BusinessKpi icon={TrendingUp} label="Sales comparison" value={salesChange === null ? "—" : `${salesChange >= 0 ? "+" : ""}${salesChange.toFixed(1)}%`} helper={comparison.dayCount ? `${comparison.dayCount} matching day${comparison.dayCount === 1 ? "" : "s"} · Previous ${formatCurrency(comparison.previousTotal)}` : "No matching previous sales days"} change={salesChange} tone="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-fuel-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-fuel-mist text-fuel-green"><BarChart3 size={20} /></span>
              <div><h2 className="font-black text-fuel-ink">Sales and order trend</h2><p className="text-xs font-semibold text-slate-500">{formatDateLabel(range.start)} – {formatDateLabel(range.end)}</p></div>
            </div>
            <div className="flex gap-3 text-xs font-black text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-fuel-green" /> Sales</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Orders</span></div>
          </div>
          {trendRows.some((row) => row.sales || row.orders) ? (
            <div className="grid h-64 items-end gap-2 p-4" style={{ gridTemplateColumns: `repeat(${trendRows.length}, minmax(0, 1fr))` }}>
              {trendRows.map((row) => (
                <div key={row.key} className="flex h-full min-w-0 flex-col justify-end">
                  <div className="flex flex-1 items-end justify-center gap-1">
                    <div title={`Sales ${formatCurrency(row.sales)}`} className="w-3 rounded-t bg-fuel-green sm:w-5" style={{ height: reportBarHeight(row.sales, maxTrend) }} />
                    <div title={`Orders ${formatCurrency(row.orders)}`} className="w-3 rounded-t bg-amber-400 sm:w-5" style={{ height: reportBarHeight(row.orders, maxTrend) }} />
                  </div>
                  <p className="mt-2 truncate text-center text-[10px] font-black text-slate-500 sm:text-xs">{row.label}</p>
                </div>
              ))}
            </div>
          ) : <div className="p-5"><EmptyLine /></div>}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-700"><PackageCheck size={20} /></span><div><h2 className="font-black text-fuel-ink">Order analysis</h2><p className="text-xs font-semibold text-slate-500">Submitted values by section</p></div></div>
            <button type="button" onClick={() => goTo("tasks")} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">Open Work</button>
          </div>
          <div className="mt-4 space-y-2">
            {departments.length ? departments.map(([department, total]) => (
              <div key={department} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"><span className="truncate text-sm font-bold text-slate-600">{department}</span><span className="font-black text-fuel-ink">{formatCurrency(total)}</span></div>
            )) : <EmptyLine />}
          </div>
          {orders.length > 0 && (
            <div className="mt-4 border-t border-fuel-line pt-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Submitted orders</p>
              <div className="space-y-2">{orders.slice(0, 4).map((order) => <MetricRow key={order.taskId} label={`${order.supplier ? `${order.supplier} · ` : ""}${order.orderName}`} value={formatCurrency(order.total)} />)}</div>
            </div>
          )}
        </Card>
      </div>
      <p className="px-1 text-xs font-semibold text-slate-500">Sales comparison uses only dates recorded in both periods. Order-to-sales includes orders due on recorded sales days and is an operational indicator, not a profit margin.</p>
    </section>
  );
}

function BusinessKpi({ change = null, helper, icon: Icon, label, tone = "blue", value }) {
  const positive = change !== null && change >= 0;
  const toneClasses = {
    blue: "bg-fuel-mist text-fuel-green",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700"
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneClasses[tone] || toneClasses.blue}`}><Icon size={19} /></span>
        {change !== null && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change).toFixed(1)}%</span>}
      </div>
      <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-fuel-ink">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={helper}>{helper}</p>
    </Card>
  );
}

function WeeklySalesTracker() {
  const currentStart = React.useMemo(() => getMonday(new Date()), []);
  const previousStart = React.useMemo(() => addDays(currentStart, -7), [currentStart]);
  const currentDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(currentStart, index))),
    [currentStart]
  );
  const previousDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(previousStart, index))),
    [previousStart]
  );
  const [values, setValues] = React.useState({});
  const [communication, setCommunication] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      api.sales(previousDates[0], currentDates[6]),
      api.salesCommunication(currentDates[0])
    ])
      .then(([rows, weeklyNote]) => {
        setValues(Object.fromEntries(rows.map((row) => [row.saleDate, String(row.amount)])));
        setCommunication(weeklyNote.communication || "");
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentDates, previousDates]);

  const comparableIndexes = currentDates
    .map((currentDate, index) => (
      hasSalesValue(values[currentDate]) && hasSalesValue(values[previousDates[index]]) ? index : -1
    ))
    .filter((index) => index >= 0);
  const currentComparisonDates = comparableIndexes.map((index) => currentDates[index]);
  const previousComparisonDates = comparableIndexes.map((index) => previousDates[index]);
  const currentTotal = sumSales(currentComparisonDates, values);
  const previousTotal = sumSales(previousComparisonDates, values);
  const difference = currentTotal - previousTotal;
  const percentage = previousTotal > 0 ? (difference / previousTotal) * 100 : null;
  const currentEntered = currentDates.filter((date) => hasSalesValue(values[date])).length;

  const updateValue = (date, value) => {
    setValues((current) => ({ ...current, [date]: value }));
    setSaved(false);
  };

  const saveSales = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const dates = [...previousDates, ...currentDates];
      await Promise.all([
        api.updateSales(dates.map((saleDate) => ({
          saleDate,
          amount: values[saleDate] === undefined || values[saleDate] === "" ? null : Number(values[saleDate])
        }))),
        api.updateSalesCommunication({ weekStart: currentDates[0], communication })
      ]);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-fuel-line p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuel-mist text-fuel-green">
              <PoundSterling size={22} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuel-green">Performance tracker</p>
              <h2 className="mt-1 text-2xl font-black text-fuel-ink">Weekly sales</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">Enter the end-of-day sales total and compare this week with last week.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={saveSales}
            disabled={loading || saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fuel-green px-5 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? "Saving..." : saved ? "Sales saved" : "Save sales"}
          </button>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      </div>

      <div className="grid gap-3 border-b border-fuel-line bg-slate-50 p-4 sm:grid-cols-3">
        <SalesSummary label="Sales (£)" value={formatCurrency(currentTotal)} helper={`${currentEntered}/7 current-week figures entered`} />
        <SalesSummary label="Last week" value={formatCurrency(previousTotal)} helper={`${comparableIndexes.length} matching days compared`} />
        <SalesSummary
          label="Weekly change"
          value={formatSignedCurrency(difference)}
          helper={percentage === null ? "Enter matching days to calculate %" : `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`}
          trend={difference}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.9fr] gap-3 border-b border-fuel-line bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
            <span>Day</span>
            <span>Sales (£)</span>
            <span>Last week</span>
            <span className="text-right">+/- LW</span>
            <span className="text-right">Cumulative</span>
          </div>
          {currentDates.map((currentDate, index) => {
            const previousDate = previousDates[index];
            const currentAmount = numberFromInput(values[currentDate]);
            const previousAmount = numberFromInput(values[previousDate]);
            const hasComparison = hasSalesValue(values[currentDate]) && hasSalesValue(values[previousDate]);
            const dailyDifference = hasComparison ? currentAmount - previousAmount : null;
            const cumulativeDifference = currentDates
              .slice(0, index + 1)
              .reduce((total, date, cumulativeIndex) => {
                const matchingPreviousDate = previousDates[cumulativeIndex];
                if (!hasSalesValue(values[date]) || !hasSalesValue(values[matchingPreviousDate])) return total;
                return total + numberFromInput(values[date]) - numberFromInput(values[matchingPreviousDate]);
              }, 0);
            const hasCumulative = hasComparison;
            return (
              <div key={currentDate} className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.9fr] items-center gap-3 border-b border-fuel-line px-5 py-3 last:border-b-0">
                <div>
                  <p className="font-black text-fuel-ink">{new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${currentDate}T00:00:00`))}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatDayLabel(currentDate)}</p>
                </div>
                <SalesInput
                  date={currentDate}
                  value={values[currentDate] ?? ""}
                  onChange={(value) => updateValue(currentDate, value)}
                  loading={loading}
                />
                <SalesInput
                  date={previousDate}
                  value={values[previousDate] ?? ""}
                  onChange={(value) => updateValue(previousDate, value)}
                  loading={loading}
                />
                <p className={`text-right text-sm font-black ${dailyDifference > 0 ? "text-emerald-700" : dailyDifference < 0 ? "text-red-700" : "text-slate-500"}`}>
                  {formatSignedCurrency(dailyDifference)}
                </p>
                <p className={`text-right text-sm font-black ${cumulativeDifference > 0 ? "text-emerald-700" : cumulativeDifference < 0 ? "text-red-700" : "text-slate-500"}`}>
                  {hasCumulative ? formatSignedCurrency(cumulativeDifference) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-fuel-line bg-slate-50 p-5">
        <label className="block">
          <span className="text-sm font-black uppercase tracking-wide text-fuel-ink">Communication</span>
          <span className="mt-1 block text-xs font-semibold text-slate-500">Add the weekly message, sales focus, or action for the team.</span>
          <textarea
            rows="3"
            maxLength="2000"
            value={communication}
            disabled={loading}
            onChange={(event) => {
              setCommunication(event.target.value);
              setSaved(false);
            }}
            placeholder="Example: Strong Tuesday. Focus on meal deals and impulse sales this weekend."
            className="mt-3 w-full resize-y rounded-lg border border-fuel-line bg-white p-3 text-sm font-semibold text-fuel-ink outline-none focus:border-fuel-green focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </label>
      </div>
    </Card>
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
    <div className="rounded-lg border border-fuel-line bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-2xl font-black text-fuel-ink">{value}</p>
        {label === "Weekly change" && <TrendIcon className={`h-5 w-5 ${trendClass}`} />}
      </div>
      <p className={`mt-1 text-xs font-bold ${label === "Weekly change" ? trendClass : "text-slate-500"}`}>{helper}</p>
    </div>
  );
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

const reportTones = {
  blue: { icon: "bg-blue-50 text-blue-700", accent: "bg-blue-500" },
  indigo: { icon: "bg-indigo-50 text-indigo-700", accent: "bg-indigo-500" },
  emerald: { icon: "bg-emerald-50 text-emerald-700", accent: "bg-emerald-500" },
  amber: { icon: "bg-amber-50 text-amber-700", accent: "bg-amber-500" }
};

const chartColours = ["#176ef2", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#64748b"];

function ReportKpi({ helper, icon: Icon, label, tone = "blue", value }) {
  const colours = reportTones[tone] || reportTones.blue;
  return (
    <Card className="relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${colours.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-fuel-ink">{value}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-500" title={helper}>{helper}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colours.icon}`}>
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

function HoursTrendChart({ onOpenRota, rows }) {
  const maxHours = Math.max(...rows.map((row) => row.hours), 1);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-fuel-green">
            <TrendingUp size={20} />
          </span>
          <div>
            <h2 className="text-lg font-black text-fuel-ink">Scheduled hours</h2>
            <p className="text-xs font-bold text-slate-500">Paid hours across the selected period</p>
          </div>
        </div>
        <button type="button" onClick={onOpenRota} className="rounded-md bg-fuel-mist px-3 py-2 text-xs font-black text-fuel-green hover:bg-blue-100">
          Open rota
        </button>
      </div>

      {rows.some((row) => row.hours > 0) ? (
        <div className="mt-6 overflow-x-auto pb-1">
          <div className="flex h-56 min-w-[520px] items-end gap-2 border-b border-slate-200 px-1">
            {rows.map((row, index) => {
              const height = Math.max((row.hours / maxHours) * 168, row.hours > 0 ? 12 : 2);
              return (
                <div key={row.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-[10px] font-black text-slate-500 opacity-0 transition group-hover:opacity-100">{formatHours(row.hours)}h</span>
                  <div
                    className={`w-full max-w-12 rounded-t-md transition hover:opacity-80 ${index === rows.length - 1 ? "bg-blue-400" : "bg-fuel-green"}`}
                    style={{ height }}
                    title={`${row.label}: ${formatHours(row.hours)} paid hours`}
                  />
                  <span className="mt-2 max-w-full truncate text-[10px] font-black text-slate-500">{row.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5 flex h-48 flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
          <Activity className="text-slate-300" size={28} />
          <p className="mt-2 text-sm font-black text-slate-500">No scheduled hours</p>
          <p className="text-xs font-bold text-slate-400">Add shifts to see the trend.</p>
        </div>
      )}
    </Card>
  );
}

function StaffHoursDonut({ rows, totalHours }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
          <Users size={20} />
        </span>
        <div>
          <h2 className="text-lg font-black text-fuel-ink">Hours by staff</h2>
          <p className="text-xs font-bold text-slate-500">Share of scheduled paid hours</p>
        </div>
      </div>

      {rows.length ? (
        <>
          <div className="relative mx-auto mt-4 h-48 w-48">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="Staff hours distribution chart">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
              {rows.map((row, index) => {
                const segment = totalHours > 0 ? (row.hours / totalHours) * circumference : 0;
                const offset = -cumulative;
                cumulative += segment;
                return (
                  <circle
                    key={row.id}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={chartColours[index % chartColours.length]}
                    strokeWidth="14"
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <strong className="text-2xl font-black text-fuel-ink">{formatHours(totalHours)}h</strong>
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Total hours</span>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {rows.slice(0, 6).map((row, index) => (
              <div key={row.id} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColours[index % chartColours.length] }} />
                <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{row.name}</span>
                <strong className="text-fuel-ink">{formatHours(row.hours)}h</strong>
                <span className="w-9 text-right font-bold text-slate-400">{totalHours ? Math.round((row.hours / totalHours) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyLine />
      )}
    </Card>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
      <p className="text-lg font-black text-fuel-ink">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
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

function percentageChange(current, previous) {
  if (!Number(previous)) return null;
  return ((Number(current || 0) - Number(previous)) / Number(previous)) * 100;
}

function buildMatchingSalesComparison(range, previousRange, sales, previousSales) {
  const currentByDate = new Map(sales.map((entry) => [entry.saleDate, Number(entry.amount || 0)]));
  const previousByDate = new Map(previousSales.map((entry) => [entry.saleDate, Number(entry.amount || 0)]));
  const currentStart = new Date(`${range.start}T00:00:00`);
  const previousStart = new Date(`${previousRange.start}T00:00:00`);
  const rangeEnd = new Date(`${range.end}T00:00:00`);
  const rangeDays = Math.round((rangeEnd - currentStart) / 86400000) + 1;
  let currentTotal = 0;
  let previousTotal = 0;
  let dayCount = 0;

  for (let index = 0; index < rangeDays; index += 1) {
    const currentDate = toDateInputValue(addDays(currentStart, index));
    const previousDate = toDateInputValue(addDays(previousStart, index));
    if (!currentByDate.has(currentDate) || !previousByDate.has(previousDate)) continue;
    currentTotal += currentByDate.get(currentDate) || 0;
    previousTotal += previousByDate.get(previousDate) || 0;
    dayCount += 1;
  }

  return { currentTotal, previousTotal, dayCount };
}

function reportBarHeight(value, maxValue) {
  if (!Number(value)) return "0%";
  return `${Math.max(4, (Number(value) / maxValue) * 100)}%`;
}

function buildBusinessTrend(range, sales, orders) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const dayCount = Math.round((end - start) / 86400000) + 1;
  const salesByDate = new Map(sales.map((entry) => [entry.saleDate, Number(entry.amount || 0)]));
  const ordersByDate = new Map();
  orders.forEach((order) => ordersByDate.set(order.dueDate, (ordersByDate.get(order.dueDate) || 0) + Number(order.total || 0)));

  if (dayCount <= 14) {
    return Array.from({ length: dayCount }, (_, index) => {
      const date = toDateInputValue(addDays(start, index));
      return {
        key: date,
        label: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(`${date}T00:00:00`)),
        sales: salesByDate.get(date) || 0,
        orders: ordersByDate.get(date) || 0
      };
    });
  }

  const groups = new Map();
  for (let index = 0; index < dayCount; index += 1) {
    const dateObject = addDays(start, index);
    const date = toDateInputValue(dateObject);
    const weekStart = toDateInputValue(getMonday(dateObject));
    const group = groups.get(weekStart) || { key: weekStart, label: `w/c ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${weekStart}T00:00:00`))}`, sales: 0, orders: 0 };
    group.sales += salesByDate.get(date) || 0;
    group.orders += ordersByDate.get(date) || 0;
    groups.set(weekStart, group);
  }
  return [...groups.values()];
}

function getPreviousRange(range) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  const previousEnd = addDays(start, -1);
  return {
    start: toDateInputValue(addDays(previousEnd, -(days - 1))),
    end: toDateInputValue(previousEnd)
  };
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

function getRangeChunks(startDate, endDate) {
  const chunks = [];
  let cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    chunks.push(toDateInputValue(cursor));
    cursor = addDays(cursor, 7);
  }
  return chunks;
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row.id ?? `${row.staffId}:${row.shiftDate}:${row.startTime}:${row.endTime}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueRowsBy(rows, keyName) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row?.[keyName] ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildHoursTrend(startDate, endDate, shifts) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dayCount = Math.round((end - start) / 86400000) + 1;

  if (dayCount <= 10) {
    return Array.from({ length: dayCount }, (_, index) => {
      const date = toDateInputValue(addDays(start, index));
      return {
        key: date,
        label: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(`${date}T00:00:00`)),
        hours: sumHours(shifts.filter((shift) => shift.shiftDate === date))
      };
    });
  }

  return getRangeChunks(startDate, endDate).map((chunkStart, index) => {
    const chunkStartDate = new Date(`${chunkStart}T00:00:00`);
    const chunkEndDate = addDays(chunkStartDate, 6);
    const boundedEnd = chunkEndDate > end ? end : chunkEndDate;
    const chunkEnd = toDateInputValue(boundedEnd);
    return {
      key: chunkStart,
      label: `${new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(chunkStartDate)}–${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(boundedEnd)}`,
      hours: sumHours(shifts.filter((shift) => shift.shiftDate >= chunkStart && shift.shiftDate <= chunkEnd)),
      index
    };
  });
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
