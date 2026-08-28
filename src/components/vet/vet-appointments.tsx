"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Eye,
  Loader2,
  LogIn,
  Play,
  Search,
  Stethoscope,
} from "lucide-react";
import { motion } from "framer-motion";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { formatBDT, formatDate, formatDateShort, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { AppointmentDTO } from "@/lib/types";

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

type Tab = "today" | "upcoming" | "pending" | "completed" | "all";

interface TreatmentForm {
  symptoms: string;
  diagnosis: string;
  treatmentPlan: string;
  prescription: string;
  medication: string;
  dosage: string;
  followUpDate: string;
  notes: string;
}

const EMPTY_TREATMENT: TreatmentForm = {
  symptoms: "",
  diagnosis: "",
  treatmentPlan: "",
  prescription: "",
  medication: "",
  dosage: "",
  followUpDate: "",
  notes: "",
};

/* ------------------------------------------------------------------ */
/* Treatment dialog                                                    */
/* ------------------------------------------------------------------ */

function TreatmentDialog({
  appointment,
  open,
  onOpenChange,
  onSaved,
}: {
  appointment: AppointmentDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TreatmentForm>(EMPTY_TREATMENT);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof TreatmentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { appointmentId: appointment.id };
      for (const [k, v] of Object.entries(form)) {
        if (v.trim() !== "") body[k] = v.trim();
      }
      await apiFetch("/api/treatments", { method: "POST", body });
      toast.success("Treatment record saved");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            Add treatment — {appointment.pet.name}
          </DialogTitle>
          <DialogDescription>
            {appointment.service.icon} {appointment.service.name} · {formatDate(appointment.date)} at{" "}
            {formatTime(appointment.time)}. Saving marks the appointment as completed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="t-symptoms">Symptoms</Label>
            <Textarea
              id="t-symptoms"
              placeholder="What did you observe?"
              value={form.symptoms}
              onChange={set("symptoms")}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-diagnosis">Diagnosis</Label>
            <Textarea
              id="t-diagnosis"
              placeholder="Diagnosis or assessment"
              value={form.diagnosis}
              onChange={set("diagnosis")}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-plan">Treatment plan</Label>
            <Textarea
              id="t-plan"
              placeholder="Plan / procedure performed"
              value={form.treatmentPlan}
              onChange={set("treatmentPlan")}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-prescription">Prescription</Label>
            <Textarea
              id="t-prescription"
              placeholder="Prescribed items or instructions"
              value={form.prescription}
              onChange={set("prescription")}
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="t-medication">Medication</Label>
              <Input id="t-medication" value={form.medication} onChange={set("medication")} placeholder="e.g. Amoxicillin" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-dosage">Dosage</Label>
              <Input id="t-dosage" value={form.dosage} onChange={set("dosage")} placeholder="e.g. 250mg 2x/day" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-followup">Follow-up date</Label>
              <Input id="t-followup" type="date" value={form.followUpDate} onChange={set("followUpDate")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-notes">Notes</Label>
            <Textarea id="t-notes" value={form.notes} onChange={set("notes")} rows={2} placeholder="Anything else worth recording" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting} className="min-h-11 sm:min-h-9">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
            Save record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Details dialog                                                      */
/* ------------------------------------------------------------------ */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

function DetailsDialog({
  appointment,
  open,
  onOpenChange,
  actions,
  busy,
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actions?: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        {appointment ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="text-lg">{appointment.service.icon}</span>
                {appointment.service.name}
              </DialogTitle>
              <DialogDescription>
                {formatDate(appointment.date)} at {formatTime(appointment.time)} ·{" "}
                {formatBDT(appointment.price)}
              </DialogDescription>
            </DialogHeader>
            <div>
              <DetailRow label="Status">
                <span className="inline-flex flex-wrap justify-end gap-1.5">
                  <StatusBadge status={appointment.status} />
                  <StatusBadge status={appointment.paymentStatus} />
                </span>
              </DetailRow>
              <DetailRow label="Pet">
                {petEmoji(appointment.pet.type)} {appointment.pet.name}
                {appointment.pet.breed ? ` · ${appointment.pet.breed}` : ""}
              </DetailRow>
              <DetailRow label="Owner">
                <span>
                  {appointment.customer.name}
                  {appointment.customer.phone ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {appointment.customer.phone}
                    </span>
                  ) : null}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {appointment.customer.email}
                  </span>
                </span>
              </DetailRow>
              <DetailRow label="Provider">{appointment.provider.name}</DetailRow>
              <DetailRow label="Duration">{appointment.service.duration} min</DetailRow>
              <DetailRow label="Treatment">
                {appointment.treatment ? (
                  <span className="text-primary">Record available</span>
                ) : (
                  <span className="text-muted-foreground">No record yet</span>
                )}
              </DetailRow>
              {appointment.notes ? (
                <DetailRow label="Notes">
                  <span className="block max-w-xs whitespace-pre-wrap text-left text-sm font-normal text-muted-foreground">
                    {appointment.notes}
                  </span>
                </DetailRow>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
          </>
        ) : null}
        {busy ? (
          <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/60">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function VetAppointmentsView() {
  const user = useAppStore((s) => s.user);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("today");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [details, setDetails] = useState<AppointmentDTO | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [treatmentTarget, setTreatmentTarget] = useState<AppointmentDTO | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    a: AppointmentDTO;
    status: string;
    title: string;
    description: string;
  } | null>(null);

  const isVet = user?.role === "VET";

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ appointments: AppointmentDTO[] }>("/api/appointments");
      setAppointments(res.appointments);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayStr();
  const filtered = useMemo(() => {
    let list = appointments;
    if (tab === "today") list = list.filter((a) => a.date === today);
    else if (tab === "upcoming")
      list = list.filter((a) => a.date > today && a.status !== "CANCELLED");
    else if (tab === "pending") list = list.filter((a) => a.status === "PENDING");
    else if (tab === "completed") list = list.filter((a) => a.status === "COMPLETED");
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (a) =>
          a.pet.name.toLowerCase().includes(needle) ||
          a.customer.name.toLowerCase().includes(needle)
      );
    }
    const dir = tab === "all" || tab === "completed" ? -1 : 1;
    return [...list].sort(
      (x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`) * dir
    );
  }, [appointments, tab, q, today]);

  const counts = useMemo(() => {
    return {
      today: appointments.filter((a) => a.date === today).length,
      upcoming: appointments.filter((a) => a.date > today && a.status !== "CANCELLED").length,
      pending: appointments.filter((a) => a.status === "PENDING").length,
      completed: appointments.filter((a) => a.status === "COMPLETED").length,
    };
  }, [appointments, today]);

  async function setStatus(a: AppointmentDTO, status: string, message: string) {
    setBusyId(a.id);
    setDetailsOpen(false);
    try {
      await apiFetch(`/api/appointments/${a.id}/status`, { method: "PATCH", body: { status } });
      toast.success(message);
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  function askCancel(a: AppointmentDTO, kind: "decline" | "cancel") {
    setConfirmTarget({
      a,
      status: "CANCELLED",
      title: kind === "decline" ? "Decline this request?" : "Cancel this appointment?",
      description:
        kind === "decline"
          ? `${a.customer.name}'s request for ${a.pet.name} (${a.service.name}) will be declined and the owner notified.`
          : `${a.service.name} for ${a.pet.name} on ${formatDate(a.date)} will be cancelled and the owner notified.`,
    });
  }

  function openDetails(a: AppointmentDTO) {
    setDetails(a);
    setDetailsOpen(true);
  }

  function actionButtons(a: AppointmentDTO, size: "sm" | "default" = "sm") {
    const disabled = busyId === a.id;
    const btns: React.ReactNode[] = [];
    const push = (key: string, node: React.ReactNode) => btns.push(<span key={key}>{node}</span>);

    if (a.status === "PENDING") {
      push(
        "accept",
        <Button
          size={size}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            void setStatus(a, "CONFIRMED", "Appointment confirmed");
          }}
        >
          {disabled ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
          Accept
        </Button>
      );
      push(
        "decline",
        <Button
          size={size}
          variant="outline"
          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            askCancel(a, "decline");
          }}
        >
          <Ban className="size-4" />
          Decline
        </Button>
      );
    }
    if (a.status === "CONFIRMED") {
      push(
        "checkin",
        <Button
          size={size}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            void setStatus(a, "CHECKED_IN", "Pet checked in");
          }}
        >
          {disabled ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Check in
        </Button>
      );
      push(
        "cancel",
        <Button
          size={size}
          variant="outline"
          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            askCancel(a, "cancel");
          }}
        >
          <Ban className="size-4" />
          Cancel
        </Button>
      );
    }
    if (a.status === "CHECKED_IN") {
      push(
        "start",
        <Button
          size={size}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            void setStatus(a, "IN_PROGRESS", "Service started");
          }}
        >
          {disabled ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Start
        </Button>
      );
    }
    if (a.status === "IN_PROGRESS") {
      push(
        "complete",
        <Button
          size={size}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            void setStatus(a, "COMPLETED", "Appointment completed");
          }}
        >
          {disabled ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
          Complete
        </Button>
      );
      push(
        "treatment",
        <Button
          size={size}
          variant="outline"
          className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
          onClick={(e) => {
            e.stopPropagation();
            setTreatmentTarget(a);
          }}
        >
          <Stethoscope className="size-4" />
          {isVet ? "Add treatment" : "Add record"}
        </Button>
      );
    }
    return btns;
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "today", label: "Today", count: counts.today },
    { key: "upcoming", label: "Upcoming", count: counts.upcoming },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "all", label: "All", count: appointments.length },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isVet ? "Appointments" : "Grooming Sessions"}
        description={
          isVet
            ? "Accept requests, run consultations and record treatments."
            : "Accept requests, run grooming sessions and record notes."
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                {t.label}
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {t.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pet or owner…"
            className="pl-9"
            aria-label="Search appointments by pet or owner"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Nothing here"
          description={
            q
              ? "No appointments match your search."
              : "No appointments in this view yet — try another tab or check back later."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className="cursor-pointer p-4 transition-shadow hover:shadow-md"
                onClick={() => openDetails(a)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 flex-col items-center rounded-xl bg-primary/10 px-3 py-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        {formatTime(a.time)}
                      </span>
                      <span className="text-[11px] text-primary/70">
                        {a.date === today ? "Today" : formatDateShort(a.date)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {a.service.icon} {a.service.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {petEmoji(a.pet.type)} {a.pet.name}
                        {a.pet.breed ? ` (${a.pet.breed})` : ""} · {a.customer.name}
                        {a.customer.phone ? ` · ${a.customer.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={a.status} />
                    <StatusBadge status={a.paymentStatus} />
                  </div>
                </div>

                {a.notes ? (
                  <p className="mt-3 truncate rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    “{a.notes}”
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {actionButtons(a)}
                  <span className="grow" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(a);
                    }}
                  >
                    <Eye className="size-4" />
                    Details
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Details dialog */}
      <DetailsDialog
        appointment={details}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        busy={busyId !== null}
        actions={details ? actionButtons(details, "default") : null}
      />

      {/* Treatment dialog */}
      {treatmentTarget ? (
        <TreatmentDialog
          key={treatmentTarget.id}
          appointment={treatmentTarget}
          open={treatmentTarget !== null}
          onOpenChange={(v) => {
            if (!v) setTreatmentTarget(null);
          }}
          onSaved={() => void load()}
        />
      ) : null}

      {/* Decline / cancel confirmation */}
      <AlertDialog open={confirmTarget !== null} onOpenChange={(v) => !v && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTarget?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmTarget?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (confirmTarget)
                  void setStatus(confirmTarget.a, "CANCELLED", "Appointment cancelled");
              }}
            >
              {confirmTarget?.a.status === "PENDING" ? "Decline" : "Cancel appointment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
