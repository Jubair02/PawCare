"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Eye,
  Loader2,
  Star,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { PAYMENT_METHODS } from "@/lib/constants";
import { dateRelation, formatBDT, formatDate, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { AppointmentDTO, PageMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";

const CATEGORY_TILE: Record<string, string> = {
  MEDICAL: "bg-gradient-to-br from-emerald-600 to-teal-500",
  GROOMING: "bg-gradient-to-br from-amber-400 to-amber-500",
  DIAGNOSTIC: "bg-gradient-to-br from-violet-500 to-violet-600",
};

type TabKey = "upcoming" | "completed" | "cancelled" | "all";

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
}

function isUpcoming(a: AppointmentDTO): boolean {
  return (
    dateRelation(a.date) !== "past" && a.status !== "CANCELLED" && a.status !== "COMPLETED"
  );
}

// ---------- Pay now dialog ----------

function PayDialog({
  appointment,
  open,
  onOpenChange,
  onDone,
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState("CASH");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (open) setMethod("CASH");
  }, [open]);

  async function handlePay() {
    if (!appointment) return;
    setPaying(true);
    try {
      await apiFetch<{ payment: unknown; appointment: AppointmentDTO }>("/api/payments", {
        method: "POST",
        body: { appointmentId: appointment.id, method },
      });
      // Cash is settled at the counter, so do not claim it was received.
      if (method === "CASH") {
        toast.success(`Reserved — pay ${formatBDT(appointment.price)} at the front desk`);
      } else {
        toast.success("Payment successful 🎉");
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay for your appointment</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.service.name} for ${appointment.pet.name} — ${formatBDT(appointment.price)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={method} onValueChange={setMethod} className="gap-3">
          {PAYMENT_METHODS.map((pm) => (
            <Label
              key={pm.value}
              htmlFor={`appt-pay-${pm.value}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors",
                method === pm.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <RadioGroupItem value={pm.value} id={`appt-pay-${pm.value}`} />
              {pm.label}
            </Label>
          ))}
        </RadioGroup>
        {method === "CASH" ? (
          <p className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 px-3 py-2 text-xs text-orange-900 dark:text-orange-200">
            Nothing is charged now. We will hold your appointment and you pay{" "}
            {appointment ? formatBDT(appointment.price) : ""} in cash at the front desk.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying} className="min-h-11">
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={paying} className="min-h-11">
            {paying ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            {method === "CASH"
              ? "Reserve — pay at clinic"
              : `Pay ${appointment ? formatBDT(appointment.price) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Reschedule dialog ----------

function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onDone,
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(async (providerId: string, d: string) => {
    setSlotsLoading(true);
    try {
      const r = await apiFetch<{ slots: string[] }>(
        `/api/appointments/slots?providerId=${encodeURIComponent(providerId)}&date=${encodeURIComponent(d)}`
      );
      setSlots(r.slots);
    } catch (err) {
      toast.error((err as Error).message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // On open: seed date with the appointment's date (or today if past), reset time.
  useEffect(() => {
    if (!open || !appointment) return;
    setDate(dateRelation(appointment.date) === "past" ? todayStr() : appointment.date);
    setTime(null);
  }, [open, appointment]);

  // Refetch slots whenever the dialog opens or the date changes.
  useEffect(() => {
    if (!open || !appointment || !date) return;
    fetchSlots(appointment.provider.id, date);
  }, [open, appointment, date, fetchSlots]);

  async function handleSave() {
    if (!appointment || !date || !time) return;
    setSaving(true);
    try {
      await apiFetch<{ appointment: AppointmentDTO }>(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        body: { date, time },
      });
      toast.success("Appointment rescheduled");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.service.name} for ${appointment.pet.name} — pick a new date and slot.`
              : "Pick a new date and slot."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="reschedule-date">Date</Label>
          <Input
            id="reschedule-date"
            type="date"
            min={todayStr()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value || todayStr());
              setTime(null);
            }}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Available slots</p>
          {slotsLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-24 rounded-full" />
              ))}
            </div>
          ) : slots === null ? (
            <p className="text-sm text-muted-foreground">Loading slots...</p>
          ) : slots.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="No slots this day"
              description="All slots are booked or past. Try another date."
              className="py-8"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    time === slot
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:border-primary/50 hover:bg-primary/5"
                  )}
                  aria-pressed={time === slot}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !time} className="min-h-11">
            {saving ? <Loader2 className="animate-spin" /> : <CalendarClock />}
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Review dialog ----------

function ReviewDialog({
  appointment,
  open,
  onOpenChange,
  onDone,
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(0);
      setComment("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!appointment) return;
    if (rating < 1) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch<{ review: unknown }>("/api/reviews", {
        method: "POST",
        body: {
          appointmentId: appointment.id,
          rating,
          comment: comment.trim() || undefined,
        },
      });
      toast.success("Review submitted");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate your visit</DialogTitle>
          <DialogDescription>
            {appointment
              ? `How was ${appointment.service.name} for ${appointment.pet.name} with ${appointment.provider.name}?`
              : "Share your experience."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Your rating</Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                  aria-pressed={rating >= n}
                  className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Star
                    className={cn(
                      "size-8 transition-colors",
                      rating >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="review-comment">Comment (optional)</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell other pet parents about your experience..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="min-h-11">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rating < 1} className="min-h-11">
            {submitting ? <Loader2 className="animate-spin" /> : <Star />}
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Details dialog ----------

function DetailsDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const a = appointment;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Appointment details</DialogTitle>
          <DialogDescription>
            {a ? `${formatDate(a.date)} at ${formatTime(a.time)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {a ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm",
                  CATEGORY_TILE[a.service.category] ?? CATEGORY_TILE.MEDICAL
                )}
              >
                {a.service.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.service.name}</p>
                <p className="text-sm text-muted-foreground">
                  {a.service.category} · {a.service.duration} min
                </p>
              </div>
              <span className="ml-auto text-lg font-bold text-primary">{formatBDT(a.price)}</span>
            </div>

            <Separator />

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Pet:</span>
                <span className="font-medium">
                  {petEmoji(a.pet.type)} {a.pet.name}
                  {a.pet.breed ? ` (${a.pet.breed})` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Provider:</span>
                <span className="font-medium">{a.provider.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{formatDate(a.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Time:</span>
                <span className="font-medium">{formatTime(a.time)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Customer:</span>
                <span className="truncate font-medium">{a.customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{a.customer.phone ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <StatusBadge status={a.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Payment:</span>
                <StatusBadge status={a.paymentStatus} />
              </div>
            </dl>

            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="text-sm">{a.notes ? a.notes : <span className="italic text-muted-foreground">No notes added</span>}</p>
            </div>

            <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Treatment record:</span>
                {a.treatment ? (
                  <span className="font-medium text-emerald-700 dark:text-emerald-200">Available</span>
                ) : (
                  <span className="italic text-muted-foreground">Not added yet</span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Your review:</span>
                {a.review ? (
                  <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-300">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {a.review.rating}/5
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">
                    {a.status === "COMPLETED" ? "Not submitted yet" : "Available after completion"}
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Appointment row card ----------

function AppointmentCard({
  a,
  onPay,
  onCancel,
  onReschedule,
  onReview,
  onDetails,
}: {
  a: AppointmentDTO;
  onPay: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onReview: () => void;
  onDetails: () => void;
}) {
  const canPay = a.paymentStatus === "UNPAID" && a.status !== "CANCELLED" && a.status !== "COMPLETED";
  const canCancel = a.status === "PENDING" || a.status === "CONFIRMED";
  const canReschedule = a.status === "PENDING";
  const canReview = a.status === "COMPLETED" && !a.review;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="gap-0 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm",
                CATEGORY_TILE[a.service.category] ?? CATEGORY_TILE.MEDICAL
              )}
            >
              {a.service.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{a.service.name}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {petEmoji(a.pet.type)} {a.pet.name} · with {a.provider.name}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> {formatDate(a.date)}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3.5" /> {formatTime(a.time)}
                </span>
                <span>{a.service.duration} min</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <StatusBadge status={a.status} />
            <StatusBadge status={a.paymentStatus} />
            <span className="text-base font-bold text-primary">{formatBDT(a.price)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          {canPay ? (
            <Button size="sm" className="min-h-11" onClick={onPay}>
              <Wallet /> Pay now
            </Button>
          ) : null}
          {canReschedule ? (
            <Button size="sm" variant="outline" className="min-h-11" onClick={onReschedule}>
              <CalendarClock /> Reschedule
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onCancel}
            >
              <XCircle /> Cancel
            </Button>
          ) : null}
          {canReview ? (
            <Button size="sm" variant="outline" className="min-h-11" onClick={onReview}>
              <Star /> Review
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="min-h-11" onClick={onDetails}>
            <Eye /> Details
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------- Main view ----------

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  upcoming: {
    title: "No upcoming appointments",
    description: "Book your companion's next visit — vet care or a spa day is a tap away.",
  },
  completed: {
    title: "No completed appointments yet",
    description: "Finished visits will appear here with their treatment records and reviews.",
  },
  cancelled: {
    title: "No cancelled appointments",
    description: "Good news — nothing has been cancelled.",
  },
  all: {
    title: "No appointments yet",
    description: "Book your first appointment to get started.",
  },
};

export function CustomerAppointmentsView() {
  const setView = useAppStore((s) => s.setView);
  const [appointments, setAppointments] = useState<AppointmentDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("upcoming");

  const [payTarget, setPayTarget] = useState<AppointmentDTO | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentDTO | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDTO | null>(null);
  const [reviewTarget, setReviewTarget] = useState<AppointmentDTO | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<AppointmentDTO | null>(null);

  const [page, setPage] = useState<PageMeta | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ appointments: AppointmentDTO[]; page?: PageMeta }>("/api/appointments");
      setAppointments(res.appointments);
      setPage(res.page ?? null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const counts = useMemo(() => {
    const list = appointments ?? [];
    return {
      upcoming: list.filter(isUpcoming).length,
      completed: list.filter((a) => a.status === "COMPLETED").length,
      cancelled: list.filter((a) => a.status === "CANCELLED").length,
      all: list.length,
    };
  }, [appointments]);

  const filtered = useMemo(() => {
    const list = appointments ?? [];
    switch (tab) {
      case "upcoming":
        return list.filter(isUpcoming);
      case "completed":
        return list.filter((a) => a.status === "COMPLETED");
      case "cancelled":
        return list.filter((a) => a.status === "CANCELLED");
      default:
        return list;
    }
  }, [appointments, tab]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelPending(true);
    try {
      await apiFetch<{ appointment: AppointmentDTO }>(`/api/appointments/${cancelTarget.id}/status`, {
        method: "PATCH",
        body: { status: "CANCELLED" },
      });
      toast.success("Appointment cancelled");
      setCancelTarget(null);
      loadAppointments();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCancelPending(false);
    }
  }

  const bookCta = (
    <Button onClick={() => setView("cust-book")} className="min-h-11">
      <CalendarPlus /> Book an appointment
    </Button>
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="My Appointments" description="Track, pay, reschedule and review your visits">
        {bookCta}
      </SectionHeader>
      <ListNotice page={page} noun="appointments" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="upcoming" className="min-h-11">
            Upcoming ({counts.upcoming})
          </TabsTrigger>
          <TabsTrigger value="completed" className="min-h-11">
            Completed ({counts.completed})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="min-h-11">
            Cancelled ({counts.cancelled})
          </TabsTrigger>
          <TabsTrigger value="all" className="min-h-11">
            All ({counts.all})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((a) => (
            <AppointmentCard
              key={a.id}
              a={a}
              onPay={() => setPayTarget(a)}
              onCancel={() => setCancelTarget(a)}
              onReschedule={() => setRescheduleTarget(a)}
              onReview={() => setReviewTarget(a)}
              onDetails={() => setDetailsTarget(a)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title={EMPTY_COPY[tab].title}
          description={EMPTY_COPY[tab].description}
          action={bookCta}
        />
      )}

      <PayDialog
        appointment={payTarget}
        open={!!payTarget}
        onOpenChange={(v) => !v && setPayTarget(null)}
        onDone={loadAppointments}
      />
      <RescheduleDialog
        appointment={rescheduleTarget}
        open={!!rescheduleTarget}
        onOpenChange={(v) => !v && setRescheduleTarget(null)}
        onDone={loadAppointments}
      />
      <ReviewDialog
        appointment={reviewTarget}
        open={!!reviewTarget}
        onOpenChange={(v) => !v && setReviewTarget(null)}
        onDone={loadAppointments}
      />
      <DetailsDialog
        appointment={detailsTarget}
        open={!!detailsTarget}
        onOpenChange={(v) => !v && setDetailsTarget(null)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `${cancelTarget.service.name} for ${cancelTarget.pet.name} on ${formatDate(cancelTarget.date)} at ${formatTime(cancelTarget.time)} will be cancelled. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPending} className="min-h-11">
              Keep appointment
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={cancelPending}
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
            >
              {cancelPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
