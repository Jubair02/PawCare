"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Hourglass,
  Loader2,
  LogIn,
  PawPrint,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, errMsg } from "@/lib/api";
import { formatBDT, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { AppointmentDTO, StaffDashboardData } from "@/lib/types";

export function StaffDashboard() {
  const setView = useAppStore((s) => s.setView);
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<StaffDashboardData>("/api/dashboard/staff");
      setData(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkIn(a: AppointmentDTO) {
    setCheckingInId(a.id);
    try {
      await apiFetch(`/api/appointments/${a.id}/status`, {
        method: "PATCH",
        body: { status: "CHECKED_IN" },
      });
      toast.success(`${a.pet.name} checked in`);
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCheckingInId(null);
    }
  }

  const schedule = [...(data?.todaySchedule ?? [])].sort((a, b) => a.time.localeCompare(b.time));

  const quickActions: { view: string; label: string; icon: LucideIcon; desc: string }[] = [
    { view: "staff-appointments", label: "New appointment", icon: CalendarPlus, desc: "Book for a customer" },
    { view: "staff-customers", label: "Customers", icon: Users, desc: "Directory & pets" },
    { view: "staff-payments", label: "Payments", icon: Receipt, desc: "Invoices & refunds" },
  ];

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <SectionHeader
          title="Front desk overview"
          description="Today at a glance — bookings, check-ins and collections."
        />
      </motion.section>

      {/* Primary stats */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Today"
              value={data?.todayAppointments ?? 0}
              icon={<CalendarDays />}
              hint="Appointments today"
            />
            <StatCard
              title="Pending Confirmations"
              value={data?.pendingAppointments ?? 0}
              icon={<Hourglass />}
              hint="Awaiting confirmation"
              tone="amber"
            />
            <StatCard
              title="Checked-in"
              value={data?.checkedInToday ?? 0}
              icon={<LogIn />}
              hint="Pets at the clinic now"
              tone="teal"
            />
            <StatCard
              title="Revenue Today"
              value={formatBDT(data?.revenueToday ?? 0)}
              icon={<CircleCheck />}
              hint="Payments collected today"
              tone="violet"
            />
          </>
        )}
      </section>

      {/* Secondary stats */}
      <section className="grid grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Total Customers"
              value={data?.totalCustomers ?? 0}
              icon={<Users />}
              hint="Registered accounts"
            />
            <StatCard
              title="Total Pets"
              value={data?.totalPets ?? 0}
              icon={<PawPrint />}
              hint="Across all customers"
            />
          </>
        )}
      </section>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-3">
        {quickActions.map((q) => {
          const Icon = q.icon;
          return (
            <Button
              key={q.view}
              variant="outline"
              className="h-11 justify-between rounded-2xl px-4 shadow-none hover:border-primary/40 hover:bg-primary/5"
              onClick={() => setView(q.view)}
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <span className="font-medium">{q.label}</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                  · {q.desc}
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Button>
          );
        })}
      </section>

      {/* Today's schedule */}
      <section>
        <SectionHeader
          title="Today's schedule"
          description="Check pets in when they arrive — manage everything from Appointments."
        />
        <Card className="p-2 sm:p-4">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : schedule.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="No appointments today"
              description="A quiet day at the front desk. New bookings will appear here."
              action={
                <Button className="min-h-11 sm:min-h-9" onClick={() => setView("staff-appointments")}>
                  <CalendarPlus className="size-4" />
                  New appointment
                </Button>
              }
            />
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
              {schedule.map((a: AppointmentDTO) => (
                <div
                  key={a.id}
                  className="flex min-h-[64px] flex-wrap items-center gap-3 px-2 py-3 sm:px-3"
                >
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                    {formatTime(a.time)}
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                    {petEmoji(a.pet.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.customer.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.pet.name} · {a.service.icon} {a.service.name}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                  {a.status === "CONFIRMED" ? (
                    <Button
                      size="sm"
                      className="min-h-9"
                      disabled={checkingInId === a.id}
                      onClick={() => void checkIn(a)}
                    >
                      {checkingInId === a.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogIn className="size-4" />
                      )}
                      Check in
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
