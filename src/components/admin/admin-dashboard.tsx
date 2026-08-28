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
  ArrowRight,
  CalendarDays,
  Clock,
  PawPrint,
  RefreshCw,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { formatDateShort, formatBDT, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { AdminOverviewData, AppointmentDTO } from "@/lib/types";

/* ------------------------------- chart bits ------------------------------- */

/** Exact status colors per CONTRACT (no blue/indigo anywhere). */
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#10b981",
  CHECKED_IN: "#0d9488",
  IN_PROGRESS: "#8b5cf6",
  COMPLETED: "#22c55e",
  CANCELLED: "#f43f5e",
};

interface TipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
}

/** White card tooltip: border + shadow + rounded (design system). */
function ChartTip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  money?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-32 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && label !== "" ? (
        <p className="mb-1 font-semibold text-stone-800">{label}</p>
      ) : null}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color ?? "#10b981" }} />
          <span className="text-stone-500">{entry.name}</span>
          <span className="ml-auto pl-3 font-semibold text-stone-800">
            {money ? formatBDT(Number(entry.value) || 0) : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const compactMoney = (v: number) => (Math.abs(v) >= 1000 ? `৳${Number((v / 1000).toFixed(1))}k` : `৳${v}`);

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl p-4 sm:p-6">
      <div className="mb-4">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

/* --------------------------------- view ----------------------------------- */

export function AdminDashboard() {
  const setView = useAppStore((s) => s.setView);
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<AdminOverviewData>("/api/dashboard/admin");
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
        title="Couldn't load the dashboard"
        description="Please try again in a moment."
        action={
          <Button onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        }
      />
    );
  }

  const statusData = data.statusDistribution.map((s) => ({ ...s, fill: STATUS_COLORS[s.status] ?? "#78716c" }));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        description="Clinic-wide overview — customers, bookings and revenue at a glance."
      >
        <Button variant="outline" onClick={() => setTick((t) => t + 1)} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </SectionHeader>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Customers" value={data.totalCustomers} icon={<Users />} tone="default" />
        <StatCard title="Total Pets" value={data.totalPets} icon={<PawPrint />} tone="teal" />
        <StatCard title="Today's Appointments" value={data.todayAppointments} icon={<CalendarDays />} tone="violet" />
        <StatCard title="Total Revenue" value={formatBDT(data.totalRevenue)} icon={<Wallet />} tone="default" />
        <StatCard title="Pending Appointments" value={data.pendingAppointments} icon={<Clock />} tone="amber" />
        <StatCard title="Active Vets & Groomers" value={data.activeProviders} icon={<Stethoscope />} tone="teal" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Appointments by month" description="Bookings over the last 6 months">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.appointmentsByMonth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#78716c" }} dy={6} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#78716c" }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(16, 185, 129, 0.08)" }} />
                <Bar dataKey="count" name="Appointments" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Revenue by month" description="Collected payments over the last 6 months">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByMonth} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#78716c" }} dy={6} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#78716c" }}
                  tickFormatter={(v: number) => compactMoney(v)}
                  width={58}
                />
                <Tooltip content={<ChartTip money />} cursor={{ stroke: "#10b981", strokeOpacity: 0.25 }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Revenue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#revGradDash)"
                  activeDot={{ r: 4, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Popular services" description="Top 5 services by bookings">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.popularServices} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#78716c" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#57534e" }}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(245, 158, 11, 0.08)" }} />
                <Bar dataKey="count" name="Bookings" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Status distribution" description="All appointments grouped by current status">
          <div className="flex h-72 flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTip />} />
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    cornerRadius={6}
                    strokeWidth={0}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {statusData.map((s) => (
                <span key={s.status} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: s.fill }} />
                  {s.status.replace(/_/g, " ")} · {s.count}
                </span>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Recent appointments */}
      <Card className="rounded-2xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-semibold">Recent appointments</p>
            <p className="text-xs text-muted-foreground">Latest 6 bookings across the clinic</p>
          </div>
          <Button variant="outline" size="sm" className="min-h-10" onClick={() => setView("admin-appointments")}>
            View all <ArrowRight className="size-4" />
          </Button>
        </div>

        {/* Mobile: stacked list */}
        <ul className="space-y-3 md:hidden">
          {data.recentAppointments.map((a) => (
            <RecentCard key={a.id} a={a} />
          ))}
        </ul>

        {/* Desktop: mini table */}
        <div className="hidden overflow-x-auto scrollbar-thin md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Pet</th>
                <th className="py-2 pr-3 font-medium">Service</th>
                <th className="py-2 pr-3 font-medium">Date &amp; time</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentAppointments.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{a.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{a.customer.email}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{petEmoji(a.pet.type)}</span> {a.pet.name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{a.service.icon}</span> {a.service.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3">
                    {formatDateShort(a.date)} · {formatTime(a.time)}
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={a.status} />
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

function RecentCard({ a }: { a: AppointmentDTO }) {
  return (
    <li className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            <span aria-hidden className="mr-1">{a.service.icon}</span>
            {a.service.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {a.customer.name} · {petEmoji(a.pet.type)} {a.pet.name}
          </p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDateShort(a.date)} · {formatTime(a.time)}
      </p>
    </li>
  );
}
