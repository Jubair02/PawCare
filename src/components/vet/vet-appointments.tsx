"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Eye,
  Loader2,
  LogIn,
  Play,
  Scissors,
  Search,
  Stethoscope,
  type LucideIcon,
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
import { AppointmentDetailsDialog } from "@/components/shared/appointment-details-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, errMsg } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { clinicToday, formatDate, formatDateShort, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AppointmentDTO, ListCounts, PageMeta, PetDetailDTO } from "@/lib/types";

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

/**
 * The record form speaks the provider's language.
 *
 * Groomers were shown a clinical form — a stethoscope, "Diagnosis",
 * "Prescription", "Dosage" — and could not save a session without typing a
 * diagnosis. The stored columns are shared, so only the wording and the
 * required field differ; `diagnosis` and `dosage` are simply not asked for.
 */
interface RecordCopy {
  icon: LucideIcon;
  addTitle: string;
  editTitle: string;
  savedToast: string;
  completedToast: string;
  showDiagnosis: boolean;
  showDosage: boolean;
  /** Which field the API's "diagnosis or treatment plan" rule is satisfied by. */
  requiredField: "diagnosis" | "treatmentPlan";
  requiredHint: string;
  labels: {
    symptoms: string;
    symptomsPlaceholder: string;
    treatmentPlan: string;
    treatmentPlanPlaceholder: string;
    prescription: string;
    prescriptionPlaceholder: string;
    medication: string;
    medicationPlaceholder: string;
    followUp: string;
    notesPlaceholder: string;
  };
}

const VET_COPY: RecordCopy = {
  icon: Stethoscope,
  addTitle: "Add treatment",
  editTitle: "Edit treatment",
  savedToast: "Treatment record saved",
  completedToast: "Record saved — visit completed",
  showDiagnosis: true,
  showDosage: true,
  requiredField: "diagnosis",
  requiredHint: "Add a diagnosis or a treatment plan to save this record.",
  labels: {
    symptoms: "Symptoms",
    symptomsPlaceholder: "What did you observe?",
    treatmentPlan: "Treatment plan",
    treatmentPlanPlaceholder: "Plan / procedure performed",
    prescription: "Prescription",
    prescriptionPlaceholder: "Prescribed items or instructions",
    medication: "Medication",
    medicationPlaceholder: "e.g. Amoxicillin",
    followUp: "Follow-up date",
    notesPlaceholder: "Anything else worth recording",
  },
};

const GROOMER_COPY: RecordCopy = {
  icon: Scissors,
  addTitle: "Log session",
  editTitle: "Edit session",
  savedToast: "Session record saved",
  completedToast: "Session logged — appointment completed",
  showDiagnosis: false,
  showDosage: false,
  requiredField: "treatmentPlan",
  requiredHint: "Describe the work done to save this session.",
  labels: {
    symptoms: "Coat & skin condition",
    symptomsPlaceholder: "What did you notice on arrival?",
    treatmentPlan: "Work done",
    treatmentPlanPlaceholder: "Bath, clip, nail trim…",
    prescription: "Aftercare advice",
    prescriptionPlaceholder: "How the owner should care for the coat at home",
    medication: "Products used",
    medicationPlaceholder: "e.g. oatmeal shampoo",
    followUp: "Next session due",
    notesPlaceholder: "Anything else worth noting — temperament, matting, ticks",
  },
};

/* ------------------------------------------------------------------ */
/* Treatment dialog                                                    */
/* ------------------------------------------------------------------ */

function TreatmentDialog({
  appointment,
  open,
  onOpenChange,
  onSaved,
  isVet,
}: {
  appointment: AppointmentDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  /** VET gets the clinical form, GROOMER the grooming one. */
  isVet: boolean;
}) {
  const copy = isVet ? VET_COPY : GROOMER_COPY;
  const TitleIcon = copy.icon;
  const [form, setForm] = useState<TreatmentForm>(EMPTY_TREATMENT);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [patient, setPatient] = useState<PetDetailDTO | null>(null);

  const set = (k: keyof TreatmentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Reset on open. If a record already exists it is loaded below, so an edit
  // starts from what was written rather than from a blank form.
  useEffect(() => {
    if (open) {
      setForm(EMPTY_TREATMENT);
      setConfirmDiscard(false);
    }
  }, [open]);

  // The clinician should not have to remember the pet's history from another
  // screen while writing the record for it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPatient(null);
    apiFetch<{ pet: PetDetailDTO }>(`/api/pets/${appointment.pet.id}`)
      .then((r) => {
        if (cancelled) return;
        setPatient(r.pet);

        // Pre-fill from the existing record for this visit, so amending it does
        // not start blank and wipe what is already there.
        const current = r.pet.treatments?.find((t) => t.appointment.id === appointment.id);
        if (current) {
          setForm({
            symptoms: current.symptoms ?? "",
            diagnosis: current.diagnosis ?? "",
            treatmentPlan: current.treatmentPlan ?? "",
            prescription: current.prescription ?? "",
            medication: current.medication ?? "",
            dosage: current.dosage ?? "",
            followUpDate: current.followUpDate ?? "",
            notes: current.notes ?? "",
          });
        }
      })
      .catch(() => {
        // Context is a bonus - never block writing the record on it.
      });
    return () => {
      cancelled = true;
    };
  }, [open, appointment.pet.id]);

  const dirty = Object.values(form).some((v) => v.trim() !== "");
  // The server requires a diagnosis or a treatment plan; mirror that, but only
  // ask for the one this role is shown — a groomer has no diagnosis field.
  const canSave = form[copy.requiredField].trim() !== "";

  const priorTreatment = patient?.treatments?.find((t) => t.appointment.id !== appointment.id) ?? null;

  /** Closing with unsaved clinical text asks first, instead of silently discarding. */
  function requestClose(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (dirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(false);
  }

  async function submit(complete: boolean) {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { appointmentId: appointment.id, complete };
      for (const [k, v] of Object.entries(form)) {
        if (v.trim() !== "") body[k] = v.trim();
      }
      await apiFetch("/api/treatments", { method: "POST", body });
      toast.success(complete ? copy.completedToast : copy.savedToast);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TitleIcon className="size-5 text-primary" />
            {appointment.treatment ? copy.editTitle : copy.addTitle} — {appointment.pet.name}
          </DialogTitle>
          <DialogDescription>
            {appointment.service.icon} {appointment.service.name} · {formatDate(appointment.date)} at{" "}
            {formatTime(appointment.time)}.
          </DialogDescription>
        </DialogHeader>

        {/* Patient context — read-only, so the record is written with the history in view. */}
        {patient?.medicalNotes || priorTreatment || appointment.notes ? (
          <div className="grid gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 p-3 text-xs text-amber-950 dark:text-amber-200">
            {patient?.medicalNotes ? (
              <p>
                <span className="font-semibold">Medical notes: </span>
                {patient.medicalNotes}
              </p>
            ) : null}
            {appointment.notes ? (
              <p>
                <span className="font-semibold">Owner&apos;s note: </span>
                {appointment.notes}
              </p>
            ) : null}
            {priorTreatment ? (
              <p>
                <span className="font-semibold">
                  Last visit ({formatDate(priorTreatment.appointment.date)}):{" "}
                </span>
                {priorTreatment.diagnosis || priorTreatment.treatmentPlan || "nothing recorded"}
                {priorTreatment.medication ? ` · ${priorTreatment.medication}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="t-symptoms">{copy.labels.symptoms}</Label>
            <Textarea
              id="t-symptoms"
              placeholder={copy.labels.symptomsPlaceholder}
              value={form.symptoms}
              onChange={set("symptoms")}
              rows={2}
            />
          </div>
          {copy.showDiagnosis ? (
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
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="t-plan">{copy.labels.treatmentPlan}</Label>
            <Textarea
              id="t-plan"
              placeholder={copy.labels.treatmentPlanPlaceholder}
              value={form.treatmentPlan}
              onChange={set("treatmentPlan")}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-prescription">{copy.labels.prescription}</Label>
            <Textarea
              id="t-prescription"
              placeholder={copy.labels.prescriptionPlaceholder}
              value={form.prescription}
              onChange={set("prescription")}
              rows={2}
            />
          </div>
          <div className={cn("grid gap-4", copy.showDosage ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <div className="grid gap-2">
              <Label htmlFor="t-medication">{copy.labels.medication}</Label>
              <Input
                id="t-medication"
                value={form.medication}
                onChange={set("medication")}
                placeholder={copy.labels.medicationPlaceholder}
              />
            </div>
            {copy.showDosage ? (
              <div className="grid gap-2">
                <Label htmlFor="t-dosage">Dosage</Label>
                <Input id="t-dosage" value={form.dosage} onChange={set("dosage")} placeholder="e.g. 250mg 2x/day" />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="t-followup">{copy.labels.followUp}</Label>
              <Input id="t-followup" type="date" value={form.followUpDate} onChange={set("followUpDate")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-notes">Notes</Label>
            <Textarea
              id="t-notes"
              value={form.notes}
              onChange={set("notes")}
              rows={2}
              placeholder={copy.labels.notesPlaceholder}
            />
          </div>
        </div>

        {!canSave ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-300">
            <CircleAlert className="size-3.5 shrink-0" />
            {copy.requiredHint}
          </p>
        ) : null}

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => requestClose(false)} disabled={submitting} className="min-h-11 sm:min-h-9">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => void submit(false)}
            disabled={submitting || !canSave}
            className="min-h-11 sm:min-h-9"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
            Save record
          </Button>
          {appointment.status !== "COMPLETED" ? (
            <Button
              onClick={() => void submit(true)}
              disabled={submitting || !canSave}
              className="min-h-11 sm:min-h-9"
            >
              <CircleCheck className="size-4" />
              Save &amp; complete visit
            </Button>
          ) : null}
        </div>
      </DialogContent>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this record?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved notes for {appointment.pet.name}. Closing now loses them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  const [page, setPage] = useState<PageMeta | null>(null);
  const [serverCounts, setServerCounts] = useState<ListCounts | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{
        appointments: AppointmentDTO[];
        page?: PageMeta;
        counts?: ListCounts;
      }>("/api/appointments");
      setAppointments(res.appointments);
      setPage(res.page ?? null);
      setServerCounts(res.counts ?? null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = clinicToday();
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

  // Server-side totals across the whole list, not just the loaded page.
  const counts = useMemo(
    () => ({
      today: serverCounts?.today ?? 0,
      upcoming: serverCounts?.upcoming ?? 0,
      pending: serverCounts?.PENDING ?? 0,
      completed: serverCounts?.COMPLETED ?? 0,
    }),
    [serverCounts]
  );

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
          className="border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
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
          className="border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
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
    // The API allows amending a record after completion; the UI never offered it.
    if (a.status === "COMPLETED") {
      push(
        "treatment",
        <Button
          size={size}
          variant="outline"
          className="border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-800"
          onClick={(e) => {
            e.stopPropagation();
            setTreatmentTarget(a);
          }}
        >
          <Stethoscope className="size-4" />
          {a.treatment
            ? (isVet ? VET_COPY : GROOMER_COPY).editTitle
            : (isVet ? VET_COPY : GROOMER_COPY).addTitle}
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
          className="border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-200 hover:bg-violet-50 dark:bg-violet-950/40 hover:text-violet-800"
          onClick={(e) => {
            e.stopPropagation();
            setTreatmentTarget(a);
          }}
        >
          <Stethoscope className="size-4" />
          {(isVet ? VET_COPY : GROOMER_COPY).addTitle}
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
      <ListNotice page={page} noun="appointments" />

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
                role="button"
                tabIndex={0}
                className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => openDetails(a)}
                onKeyDown={(e) => {
                  // Enter/Space on a nested action button must not also open
                  // the details dialog, so only the card itself reacts.
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetails(a);
                  }
                }}
                aria-label={`Open details for ${a.service.name} — ${a.pet.name} at ${formatTime(a.time)}`}
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
      <AppointmentDetailsDialog
        appointment={details}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        busy={busyId !== null}
        actions={details ? actionButtons(details, "default") : null}
        customerLabel="Owner"
        petFirst
        showTreatment
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
          isVet={isVet}
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
