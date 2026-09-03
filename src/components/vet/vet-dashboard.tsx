"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Hourglass,
  PawPrint,
  Scissors,
  Stethoscope,
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
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { AppointmentDTO, ProviderDashboardData } from "@/lib/types";

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function lastName(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export function VetDashboard() {
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);
  const [data, setData] = useState<ProviderDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isVet = user?.role === "VET";

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<ProviderDashboardData>("/api/dashboard/provider");
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

  const displayName = isVet ? `Dr. ${lastName(user?.name)}` : user?.name ?? "";
  const schedule = [...(data?.todaySchedule ?? [])].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  const quickLinks: { view: string; label: string; icon: LucideIcon; desc: string }[] = [
    { view: "vet-appointments", label: "Appointments", icon: CalendarDays, desc: "Review & update" },
    { view: "vet-schedule", label: "Schedule", icon: CalendarClock, desc: "Week planner" },
    {
      view: "vet-treatments",
      label: isVet ? "Treatments" : "Records",
      icon: isVet ? Stethoscope : Scissors,
      desc: isVet ? "Medical notes" : "Grooming logs",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium opacity-90">{formatDate(todayStr())}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Good day, {displayName || "there"}
            </h1>
            <p className="mt-1 text-sm opacity-90">
              {isVet
                ? "Here is your practice today — consultations, patients and records."
                : "Here is your grooming day — sessions, clients and notes."}
            </p>
          </div>
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
            {isVet ? <Stethoscope className="size-6" /> : <Scissors className="size-6" />}
          </div>
        </div>
      </motion.section>

      {/* Stat cards */}
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
              title="Pending"
              value={data?.pendingAppointments ?? 0}
              icon={<Hourglass />}
              hint="Awaiting confirmation"
              tone="amber"
            />
            <StatCard
              title="Completed Today"
              value={data?.completedToday ?? 0}
              icon={<CircleCheck />}
              hint="Finished sessions"
              tone="teal"
            />
            <StatCard
              title={isVet ? "Total Patients" : "Total Clients"}
              value={data?.totalPatients ?? 0}
              icon={<PawPrint />}
              hint={isVet ? "Pets under your care" : "Pets you groom"}
              tone="violet"
            />
          </>
        )}
      </section>

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((q) => {
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
          description="Tap an appointment to manage it from your appointments list."
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
              description="Your day is clear. New bookings will appear here as they come in."
            />
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
              {schedule.map((a: AppointmentDTO) => (
                <button
                  key={a.id}
                  onClick={() => setView("vet-appointments")}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60 sm:px-3"
                >
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                    {formatTime(a.time)}
                  </span>
                  {a.pet.photo ? (
                     
                    <img
                      src={a.pet.photo}
                      alt={a.pet.name}
                      loading="lazy"
                      decoding="async"
                      className="size-9 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                      {petEmoji(a.pet.type)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {a.pet.name}
                      <span className="font-normal text-muted-foreground"> · {a.customer.name}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.service.icon} {a.service.name}
                    </span>
                  </span>
                  <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
