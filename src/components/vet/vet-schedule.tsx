"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DetailRow } from "@/components/shared/detail-row";
import { apiFetch, errMsg } from "@/lib/api";
import { clinicToday, formatBDT, formatDate, formatTime, petEmoji, toISODate } from "@/lib/formatters";
import type { AppointmentDTO } from "@/lib/types";

/** Monday of the week containing the given yyyy-MM-dd. */
function weekStartOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
  dt.setDate(dt.getDate() - offset);
  return toISODate(dt);
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toISODate(dt);
}

function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(y, m - 1, d));
}

/** Left border color per appointment status (schedule chips only — contract). */
function statusBorder(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-l-amber-400";
    case "CONFIRMED":
      return "border-l-emerald-400";
    case "CHECKED_IN":
      return "border-l-teal-400";
    case "IN_PROGRESS":
      return "border-l-violet-400";
    case "COMPLETED":
      return "border-l-green-400";
    case "CANCELLED":
      return "border-l-rose-300 opacity-70";
    default:
      return "border-l-border";
  }
}

export function VetScheduleView() {
  const [anchor, setAnchor] = useState<string>(() => clinicToday());
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppointmentDTO | null>(null);

  const weekStart = weekStartOf(anchor);
  const weekEnd = addDays(weekStart, 6);
  const today = clinicToday();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ appointments: AppointmentDTO[] }>(
        `/api/appointments?from=${weekStart}&to=${weekEnd}`
      );
      setAppointments(res.appointments);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentDTO[]>();
    for (const a of appointments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) list.sort((x, y) => x.time.localeCompare(y.time));
    return map;
  }, [appointments]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekCount = appointments.filter((a) => a.status !== "CANCELLED").length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Week schedule"
        description={
          loading
            ? "Loading your week…"
            : `${weekCount} appointment${weekCount === 1 ? "" : "s"} this week · tap a chip for details`
        }
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 sm:size-9"
            onClick={() => setAnchor(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-xl px-4 text-sm sm:h-9"
            onClick={() => setAnchor(clinicToday())}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 sm:size-9"
            onClick={() => setAnchor(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </SectionHeader>

      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarClock className="size-4 text-primary" />
        {formatDate(weekStart)} – {formatDate(weekEnd)}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        /* Seven "No sessions" columns say nothing the empty state does not, so
           the week grid gives way to it entirely. */
        <EmptyState
          icon={<CalendarDays />}
          title="Nothing booked this week"
          description="Use the arrows to browse other weeks — new bookings will show up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day, idx) => {
            const isToday = day === today;
            const list = byDay.get(day) ?? [];
            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
              >
                <Card
                  className={`flex h-full min-h-40 flex-col gap-2 p-3 ${
                    isToday ? "bg-primary/5 ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={`text-xs font-semibold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {weekdayShort(day)}
                    </span>
                    <span className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>
                      {day.slice(8)}
                    </span>
                  </div>

                  {list.length === 0 ? (
                    <p className="my-auto text-center text-xs text-muted-foreground">No sessions</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {list.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelected(a)}
                          className={`w-full rounded-lg border border-l-4 bg-background p-2 text-left transition-colors hover:bg-muted/60 ${statusBorder(a.status)}`}
                          aria-label={`${formatTime(a.time)} ${a.service.name} for ${a.pet.name}`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                              {formatTime(a.time)}
                            </span>
                            <span className="text-sm" aria-hidden>
                              {a.service.icon}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs font-semibold">
                            {petEmoji(a.pet.type)} {a.pet.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {a.customer.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Appointment details */}
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{selected.service.icon}</span>
                  {selected.service.name}
                </DialogTitle>
                <DialogDescription>
                  {formatDate(selected.date)} at {formatTime(selected.time)} ·{" "}
                  {formatBDT(selected.price)}
                </DialogDescription>
              </DialogHeader>
              <div>
                <DetailRow label="Status">
                  <span className="inline-flex flex-wrap justify-end gap-1.5">
                    <StatusBadge status={selected.status} />
                    <StatusBadge status={selected.paymentStatus} />
                  </span>
                </DetailRow>
                <DetailRow label="Pet">
                  {petEmoji(selected.pet.type)} {selected.pet.name}
                  {selected.pet.breed ? ` · ${selected.pet.breed}` : ""}
                </DetailRow>
                <DetailRow label="Owner">
                  <span>
                    {selected.customer.name}
                    {selected.customer.phone ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {selected.customer.phone}
                      </span>
                    ) : null}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {selected.customer.email}
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Provider">{selected.provider.name}</DetailRow>
                <DetailRow label="Duration">{selected.service.duration} min</DetailRow>
                <DetailRow label="Price">{formatBDT(selected.price)}</DetailRow>
                {selected.notes ? (
                  <DetailRow label="Notes">
                    <span className="block max-w-xs whitespace-pre-wrap text-left text-sm font-normal text-muted-foreground">
                      {selected.notes}
                    </span>
                  </DetailRow>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
