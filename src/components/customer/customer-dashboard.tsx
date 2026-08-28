"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  PawPrint,
  Plus,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatBDT, formatDate, formatTime } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { CustomerDashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

const GRADIENT = "bg-gradient-to-br from-emerald-600 to-teal-500";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function CustomerDashboard() {
  const setView = useAppStore((s) => s.setView);
  const firstName = useAppStore((s) => s.user?.name?.split(" ")[0] ?? "there");
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiFetch<CustomerDashboardData>("/api/dashboard/customer")
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err: Error) => {
        if (alive) console.error(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Could not load your dashboard"
        description="Something went wrong while fetching your data. Please try again."
        action={
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload
          </Button>
        }
      />
    );
  }

  const quickActions = [
    {
      label: "Book appointment",
      description: "Vet visits, grooming & more",
      icon: CalendarPlus,
      view: "cust-book",
    },
    { label: "My pets", description: "Manage pet profiles", icon: PawPrint, view: "cust-pets" },
    { label: "Payments", description: "Invoices & receipts", icon: Receipt, view: "cust-payments" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here is what is happening with your pets today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Pets" value={data.totalPets} icon={<PawPrint />} tone="default" />
        <StatCard
          title="Upcoming Appointments"
          value={data.upcomingAppointments}
          icon={<CalendarClock />}
          tone="teal"
        />
        <StatCard
          title="Completed Services"
          value={data.completedServices}
          icon={<CheckCircle2 />}
          tone="violet"
        />
        <StatCard
          title="Pending Payments"
          value={data.pendingPayments}
          icon={<Receipt />}
          tone="amber"
          hint={data.pendingAmount > 0 ? `${formatBDT(data.pendingAmount)} due` : "All settled"}
        />
      </div>

      {/* Zero pets empty state */}
      {data.totalPets === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="gap-0 border-dashed border-primary/40 bg-primary/5 p-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-sm",
                    GRADIENT
                  )}
                >
                  🐾
                </div>
                <div>
                  <p className="text-lg font-semibold">Add your first pet</p>
                  <p className="text-sm text-muted-foreground">
                    Create a profile for your companion to start booking appointments.
                  </p>
                </div>
              </div>
              <Button onClick={() => setView("cust-pets")} className="min-h-11">
                <Plus /> Add your first pet
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : null}

      {/* Next appointment highlight */}
      <section aria-label="Next appointment">
        <SectionHeader title="Next appointment" description="Your upcoming visit at a glance" />
        {data.nextAppointment ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm",
                      GRADIENT
                    )}
                  >
                    {data.nextAppointment.service.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold">{data.nextAppointment.service.name}</p>
                      <StatusBadge status={data.nextAppointment.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.nextAppointment.pet.name} · {data.nextAppointment.provider.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <CalendarClock className="size-4 text-primary" />
                      {formatDate(data.nextAppointment.date)} at {formatTime(data.nextAppointment.time)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xl font-bold text-primary">
                    {formatBDT(data.nextAppointment.price)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setView("cust-appointments")}
                    className="min-h-11"
                  >
                    Manage <ArrowRight />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title="No upcoming appointment"
            description="Your pets deserve regular care — book a vet visit or grooming session today."
            action={
              <Button onClick={() => setView("cust-book")} className="min-h-11">
                <CalendarPlus /> Book now
              </Button>
            }
          />
        )}
      </section>

      <Separator />

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <SectionHeader title="Quick actions" description="Jump straight to what you need" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((qa) => (
            <button
              key={qa.view}
              type="button"
              onClick={() => setView(qa.view)}
              className="group rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <qa.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{qa.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{qa.description}</p>
                </div>
                <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent appointments */}
      <section aria-label="Recent appointments">
        <SectionHeader title="Recent appointments" description="Your latest 5 visits and bookings">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("cust-appointments")}
            className="min-h-11"
          >
            View all <ArrowRight />
          </Button>
        </SectionHeader>
        {data.recentAppointments.length === 0 ? (
          <EmptyState
            icon={<Sparkles />}
            title="No appointments yet"
            description="Once you book a service, it will show up here."
            action={
              <Button onClick={() => setView("cust-book")} className="min-h-11">
                <CalendarPlus /> Book appointment
              </Button>
            }
          />
        ) : (
          <Card className="gap-0 p-2">
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              {data.recentAppointments.map((appt) => (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => setView("cust-appointments")}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                    {appt.service.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{appt.service.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appt.pet.name} · {appt.provider.name}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-medium">{formatDate(appt.date)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(appt.time)}</p>
                  </div>
                  <div className="hidden md:block">
                    <StatusBadge status={appt.status} />
                  </div>
                  <span className="hidden shrink-0 text-sm font-semibold text-primary lg:block">
                    {formatBDT(appt.price)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
