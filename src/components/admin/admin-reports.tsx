"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarCheck,
  Download,
  PercentCircle,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard, ChartTip, STATUS_COLORS, compactMoney } from "@/components/admin/chart-kit";
import { apiFetch } from "@/lib/api";
import { clinicToday, formatBDT } from "@/lib/formatters";
import type { AdminOverviewData } from "@/lib/types";

/* ------------------------------- chart bits ------------------------------- */

/** Donut palette for service popularity (contract order). */
const DONUT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/* --------------------------------- view ----------------------------------- */

export function AdminReportsView() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<AdminOverviewData>("/api/dashboard/admin");
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, tick]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Couldn't load reports"
        description="Please try again in a moment."
        action={
          <Button onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        }
      />
    );
  }

  /* ------------------------------ derived KPIs ------------------------------ */

  const bookings6mo = data.appointmentsByMonth.reduce((sum, m) => sum + m.count, 0);
  // Revenue over the same six months the bookings cover. Mixing this with the
  // all-time figure made "avg booking value" and the table total meaningless.
  const revenue6mo = data.revenueByMonth.reduce((sum, m) => sum + m.amount, 0);

  const cancelled = data.statusDistribution.find((s) => s.status === "CANCELLED")?.count ?? 0;
  const completed = data.statusDistribution.find((s) => s.status === "COMPLETED")?.count ?? 0;
  // Rates are over appointments that actually reached an outcome. Including
  // PENDING and CONFIRMED bookings — visits that simply have not happened yet —
  // dragged both percentages down and made them drift with the booking calendar.
  const concluded = completed + cancelled;
  const cancelRate = concluded > 0 ? Math.round((cancelled / concluded) * 100) : 0;
  const completeRate = concluded > 0 ? Math.round((completed / concluded) * 100) : 0;
  const avgBookingValue = bookings6mo > 0 ? Math.round(revenue6mo / bookings6mo) : 0;

  /* ------------------------------ derived charts ---------------------------- */

  const revenueData = data.revenueByMonth;
  const bookingsData = data.appointmentsByMonth;
  const donutData = data.popularServices.map((s, i) => ({
    ...s,
    fill: DONUT_PALETTE[i % DONUT_PALETTE.length],
  }));
  const presentStatuses = data.statusDistribution.filter((s) => s.count > 0);
  const stackedRow: Record<string, string | number> = { name: "All time" };
  for (const s of presentStatuses) stackedRow[s.status] = s.count;

  const revenueByMonthMap = new Map(data.revenueByMonth.map((m) => [m.month, m.amount]));

  // Captured here so the export closure does not depend on the nullable state.
  const monthlyRows = data.appointmentsByMonth;

  /** Month-by-month bookings and revenue, for handing to an accountant. */
  function exportCsv() {
    const rows = [
      ["Month", "Bookings", "Revenue (BDT)"],
      ...monthlyRows.map((m) => [
        m.month,
        String(m.count),
        String(revenueByMonthMap.get(m.month) ?? 0),
      ]),
      ["Total", String(bookings6mo), String(revenue6mo)],
    ];
    // Quote every cell so a comma in a label cannot shift the columns.
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");

    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    // clinicToday(), not toISOString(): a report exported at 2 AM in Dhaka was
    // named with the previous day's date.
    link.download = `pawcare-report-${clinicToday()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Reports" description="Operational insights — revenue, bookings and service performance.">
        <Button variant="outline" onClick={exportCsv} disabled={loading} className="min-h-10">
          <Download className="size-4" />
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => setTick((t) => t + 1)} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </SectionHeader>

      {/* Insight KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard title="Revenue" value={formatBDT(data.totalRevenue)} icon={<Wallet />} tone="default" hint="Collected, all time" />
        <StatCard title="Bookings" value={bookings6mo} icon={<CalendarCheck />} tone="teal" hint="Last 6 months" />
        <StatCard title="Avg booking value" value={formatBDT(avgBookingValue)} icon={<TrendingUp />} tone="amber" hint="Last 6 months" />
        <StatCard title="Cancellation rate" value={`${cancelRate}%`} icon={<PercentCircle />} tone="rose" hint={`${cancelled} of ${concluded} concluded`} />
        <StatCard title="Completion rate" value={`${completeRate}%`} icon={<PercentCircle />} tone="violet" hint={`${completed} of ${concluded} concluded`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue trend" description="Collected payments over the last 6 months">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradReport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={6} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => compactMoney(v)}
                  width={58}
                />
                <Tooltip content={<ChartTip money />} cursor={{ stroke: "var(--chart-1)", strokeOpacity: 0.25 }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#revGradReport)"
                  activeDot={{ r: 4, fill: "var(--chart-1)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Bookings per month" description="Appointment volume over the last 6 months">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={6} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--chart-1)", fillOpacity: 0.08 }} />
                <Bar dataKey="count" name="Bookings" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Service popularity" description="Top 5 services by bookings (share of total)">
          <div className="flex h-72 flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTip />} />
                  <Pie
                    data={donutData}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    cornerRadius={6}
                    strokeWidth={0}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {donutData.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: s.fill }} />
                  {s.name} · {s.count}
                </span>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Status distribution" description="All appointments grouped by current status">
          <div className="flex h-72 flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[stackedRow]} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={70}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "var(--chart-1)", fillOpacity: 0.08 }} />
                  {presentStatuses.map((s) => (
                    <Bar
                      key={s.status}
                      dataKey={s.status}
                      name={s.status.replace(/_/g, " ")}
                      stackId="status"
                      fill={STATUS_COLORS[s.status] ?? "var(--muted-foreground)"}
                      maxBarSize={44}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {presentStatuses.map((s) => (
                <span key={s.status} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? "var(--muted-foreground)" }} />
                  {s.status.replace(/_/g, " ")} · {s.count}
                </span>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Monthly breakdown table */}
      <Card className="rounded-2xl p-4 sm:p-6">
        <div className="mb-4">
          <p className="font-semibold">Monthly breakdown</p>
          <p className="text-xs text-muted-foreground">Bookings and revenue side by side for the last 6 months</p>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-center">Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingsData.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{m.month}</TableCell>
                  <TableCell className="text-center">{m.count}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBDT(revenueByMonthMap.get(m.month) ?? 0)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-center font-semibold">{bookings6mo}</TableCell>
                <TableCell className="text-right font-semibold">{formatBDT(revenue6mo)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3 className="size-3.5" /> Revenue totals reflect collected (PAID) payments only.
        </p>
      </Card>
    </div>
  );
}
