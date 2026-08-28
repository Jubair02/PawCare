"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CircleAlert,
  Loader2,
  Plus,
  Star,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { PAYMENT_METHODS, PET_TYPES, VACCINATION_STATUSES } from "@/lib/constants";
import { formatBDT, formatDate, formatTime, initials, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { AppointmentDTO, PaymentDTO, PetDTO, ProviderDTO, ServiceDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";

const MAX_PHOTO_BYTES = 400 * 1024; // 400KB
const STEPS = ["Service", "Pet", "Provider", "Date & time", "Confirm"];

const CATEGORY_TILE: Record<string, string> = {
  MEDICAL: "bg-gradient-to-br from-emerald-600 to-teal-500",
  GROOMING: "bg-gradient-to-br from-amber-400 to-amber-500",
  DIAGNOSTIC: "bg-gradient-to-br from-violet-500 to-violet-600",
};

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
}

function Stars({ value, count }: { value: number | null | undefined; count?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground">No reviews yet</span>;
  }
  return (
    <span className="flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      <span className="text-xs font-semibold">{value.toFixed(1)}</span>
      {count !== undefined ? <span className="text-xs text-muted-foreground">({count})</span> : null}
    </span>
  );
}

function StepHint({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <p className="flex items-center justify-end gap-1 text-xs text-amber-600">
      <CircleAlert className="size-3.5" /> {children}
    </p>
  );
}

// ---------- Step 2 inline add-pet dialog ----------

interface NewPetForm {
  name: string;
  type: string;
  breed: string;
  gender: string;
  birthDate: string;
  weight: string;
  color: string;
  vaccinationStatus: string;
  medicalNotes: string;
  photo: string;
}

const EMPTY_NEW_PET: NewPetForm = {
  name: "",
  type: "DOG",
  breed: "",
  gender: "MALE",
  birthDate: "",
  weight: "",
  color: "",
  vaccinationStatus: "NONE",
  medicalNotes: "",
  photo: "",
};

function InlineAddPetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (pet: PetDTO) => void;
}) {
  const [form, setForm] = useState<NewPetForm>(EMPTY_NEW_PET);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_NEW_PET);
      setNameError(null);
    }
  }, [open]);

  const set = (key: keyof NewPetForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image is too large — please pick one under 400KB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("photo", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      setNameError("Pet name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ pet: PetDTO }>("/api/pets", {
        method: "POST",
        body: {
          name: form.name.trim(),
          type: form.type,
          breed: form.breed.trim() || undefined,
          gender: form.gender,
          birthDate: form.birthDate || undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          color: form.color.trim() || undefined,
          vaccinationStatus: form.vaccinationStatus,
          medicalNotes: form.medicalNotes.trim() || undefined,
          photo: form.photo || undefined,
        },
      });
      toast.success(`${res.pet.name} added`);
      onOpenChange(false);
      onCreated(res.pet);
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
          <DialogTitle>Add a new pet</DialogTitle>
          <DialogDescription>
            Tell us about your companion so we can care for them better.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="book-pet-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="book-pet-name"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. Bruno"
              aria-invalid={!!nameError}
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-pet-breed">Breed</Label>
              <Input
                id="book-pet-breed"
                value={form.breed}
                onChange={(e) => set("breed", e.target.value)}
                placeholder="e.g. Poodle"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Gender</Label>
            <RadioGroup value={form.gender} onValueChange={(v) => set("gender", v)} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="MALE" id="book-gender-male" />
                <Label htmlFor="book-gender-male" className="font-normal">
                  Male
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FEMALE" id="book-gender-female" />
                <Label htmlFor="book-gender-female" className="font-normal">
                  Female
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="book-pet-birth">Birth date</Label>
              <Input
                id="book-pet-birth"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-pet-weight">Weight (kg)</Label>
              <Input
                id="book-pet-weight"
                type="number"
                min="0"
                step="0.1"
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                placeholder="e.g. 12.5"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Vaccination status</Label>
            <Select value={form.vaccinationStatus} onValueChange={(v) => set("vaccinationStatus", v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {VACCINATION_STATUSES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="book-pet-notes">Medical notes</Label>
            <Textarea
              id="book-pet-notes"
              value={form.medicalNotes}
              onChange={(e) => set("medicalNotes", e.target.value)}
              placeholder="Allergies, chronic conditions, medication..."
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="book-pet-photo">Photo</Label>
            <div className="flex items-center gap-3">
              {form.photo ? (
                 
                <img
                  src={form.photo}
                  alt="Pet preview"
                  className="h-14 w-14 rounded-xl border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {petEmoji(form.type)}
                </div>
              )}
              <Input
                id="book-pet-photo"
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 400KB.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="min-h-11">
            {saving ? <Loader2 className="animate-spin" /> : null}
            Add pet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Payment dialog (post-booking) ----------

function PaymentDialog({
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
      await apiFetch<{ payment: PaymentDTO; appointment: AppointmentDTO }>("/api/payments", {
        method: "POST",
        body: { appointmentId: appointment.id, method },
      });
      toast.success("Payment successful 🎉");
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
            {appointment ? `${appointment.service.name} — ${formatBDT(appointment.price)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={method} onValueChange={setMethod} className="gap-3">
          {PAYMENT_METHODS.map((pm) => (
            <Label
              key={pm.value}
              htmlFor={`pay-${pm.value}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors",
                method === pm.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <RadioGroupItem value={pm.value} id={`pay-${pm.value}`} />
              {pm.label}
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying} className="min-h-11">
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={paying} className="min-h-11">
            {paying ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            Pay {appointment ? formatBDT(appointment.price) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main booking flow ----------

export function BookingFlow() {
  const setView = useAppStore((s) => s.setView);
  const [step, setStep] = useState(1);
  const [booked, setBooked] = useState<AppointmentDTO | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  // selections
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // data
  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [pets, setPets] = useState<PetDTO[] | null>(null);
  const [providers, setProviders] = useState<ProviderDTO[] | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services?.find((s) => s.id === serviceId) ?? null;
  const selectedPet = pets?.find((p) => p.id === petId) ?? null;
  const selectedProvider = providers?.find((p) => p.id === providerId) ?? null;

  useEffect(() => {
    apiFetch<{ services: ServiceDTO[] }>("/api/services?active=true")
      .then((r) => setServices(r.services))
      .catch((err: Error) => toast.error(err.message));
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    apiFetch<{ pets: PetDTO[] }>("/api/pets")
      .then((r) => setPets(r.pets))
      .catch((err: Error) => toast.error(err.message));
  }, [step, addPetOpen]);

  useEffect(() => {
    if (step !== 3 || !selectedService) return;
    const specialty = selectedService.category === "GROOMING" ? "GROOMER" : "VET";
    setProviders(null);
    setProviderId(null);
    apiFetch<{ providers: ProviderDTO[] }>(`/api/providers?specialty=${specialty}`)
      .then((r) => setProviders(r.providers))
      .catch((err: Error) => toast.error(err.message));
  }, [step, selectedService]);

  const fetchSlots = useCallback(async (pid: string, d: string) => {
    setSlotsLoading(true);
    try {
      const r = await apiFetch<{ slots: string[] }>(
        `/api/appointments/slots?providerId=${encodeURIComponent(pid)}&date=${encodeURIComponent(d)}`
      );
      setSlots(r.slots);
    } catch (err) {
      toast.error((err as Error).message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 4 || !providerId || !date) return;
    setTime(null);
    setSlots(null);
    fetchSlots(providerId, date);
  }, [step, providerId, date, fetchSlots]);

  const stepValid =
    (step === 1 && !!serviceId) ||
    (step === 2 && !!petId) ||
    (step === 3 && !!providerId) ||
    (step === 4 && !!time) ||
    step === 5;

  function goNext() {
    if (!stepValid) return;
    setStep((s) => Math.min(s + 1, 5));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleConfirm() {
    if (!serviceId || !petId || !providerId || !time) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ appointment: AppointmentDTO }>("/api/appointments", {
        method: "POST",
        body: { petId, serviceId, providerId, date, time, notes: notes.trim() || undefined },
      });
      setBooked(res.appointment);
      toast.success("Appointment booked");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- success panel ----------
  if (booked) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-lg"
      >
        <Card className="gap-0 p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
          >
            <Check className="size-9 text-primary" />
          </motion.div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">Appointment booked!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {booked.service.name} for {booked.pet.name} with {booked.provider.name}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" />
            {formatDate(booked.date)} at {formatTime(booked.time)}
          </p>
          <div className="mt-2">
            <StatusBadge status={booked.status} />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => setPayOpen(true)} className="min-h-11">
              <BadgeCheck /> Pay now ({formatBDT(booked.price)})
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("You can pay anytime from your appointments");
                setView("cust-appointments");
              }}
              className="min-h-11"
            >
              Pay later
            </Button>
          </div>
        </Card>
        <PaymentDialog
          appointment={booked}
          open={payOpen}
          onOpenChange={setPayOpen}
          onDone={() => setView("cust-appointments")}
        />
      </motion.div>
    );
  }

  const maxCompleted = (() => {
    if (serviceId === null) return 1;
    if (petId === null) return 2;
    if (providerId === null) return 3;
    if (time === null) return 4;
    return 5;
  })();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Book an appointment</h1>
          <Button variant="ghost" size="sm" onClick={() => setView("cust-dashboard")} className="min-h-11">
            Cancel
          </Button>
        </div>
        <ol className="mt-4 grid grid-cols-5 gap-1 sm:gap-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <li key={label} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={n > maxCompleted}
                  onClick={() => n <= maxCompleted && setStep(n)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                    n <= maxCompleted && !active && "cursor-pointer hover:border-primary/50"
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="size-4" /> : n}
                </button>
                <span
                  className={cn(
                    "text-center text-[10px] font-medium sm:text-xs",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {step === 1 ? (
            <section aria-label="Choose a service" className="space-y-4">
              {services === null ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 rounded-2xl" />
                  ))}
                </div>
              ) : services.length === 0 ? (
                <EmptyState icon={<Star />} title="No services available" description="Please check back later." />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setServiceId(svc.id)}
                      className={cn(
                        "rounded-2xl border p-4 text-left shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-primary",
                        serviceId === svc.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "bg-card hover:border-primary/40 hover:shadow-md"
                      )}
                      aria-pressed={serviceId === svc.id}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm",
                            CATEGORY_TILE[svc.category] ?? CATEGORY_TILE.MEDICAL
                          )}
                        >
                          {svc.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{svc.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="size-3" /> {svc.duration} min
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{svc.description}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3">
                        <span className="text-base font-bold text-primary">{formatBDT(svc.price)}</span>
                        <Stars value={svc.rating ?? null} count={svc.reviewCount} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {step === 2 ? (
            <section aria-label="Choose a pet" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Who is this appointment for?</p>
                <Button variant="outline" onClick={() => setAddPetOpen(true)} className="min-h-11">
                  <Plus /> Add new pet
                </Button>
              </div>
              {pets === null ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              ) : pets.length === 0 ? (
                <EmptyState
                  icon={<Plus />}
                  title="No pets yet"
                  description="Add a pet to continue with your booking."
                  action={
                    <Button onClick={() => setAddPetOpen(true)} className="min-h-11">
                      <Plus /> Add new pet
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => setPetId(pet.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-primary",
                        petId === pet.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "bg-card hover:border-primary/40 hover:shadow-md"
                      )}
                      aria-pressed={petId === pet.id}
                    >
                      {pet.photo ? (
                         
                        <img
                          src={pet.photo}
                          alt={pet.name}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-2xl">
                          {petEmoji(pet.type)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{pet.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {pet.breed ?? String(pet.type).replace(/_/g, " ")}
                        </p>
                      </div>
                      {petId === pet.id ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {step === 3 ? (
            <section aria-label="Choose a provider" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedService?.category === "GROOMING"
                  ? "Pick a groomer for the session"
                  : "Pick a veterinarian for the visit"}
              </p>
              {providers === null ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <EmptyState
                  icon={<Star />}
                  title="No providers available"
                  description={
                    selectedService?.category === "GROOMING"
                      ? "There are no active groomers right now."
                      : "There are no active veterinarians right now."
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {providers.map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => setProviderId(prov.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-primary",
                        providerId === prov.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "bg-card hover:border-primary/40 hover:shadow-md"
                      )}
                      aria-pressed={providerId === prov.id}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-sm font-bold text-white">
                        {initials(prov.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{prov.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {prov.specialty === "GROOMER" ? "Groomer" : "Veterinarian"}
                        </p>
                        <div className="mt-1">
                          <Stars value={prov.rating ?? null} count={prov.reviewCount} />
                        </div>
                      </div>
                      {providerId === prov.id ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {step === 4 ? (
            <section aria-label="Choose date and time" className="space-y-4">
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="book-date">Date</Label>
                <Input
                  id="book-date"
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
            </section>
          ) : null}

          {step === 5 ? (
            <section aria-label="Confirm booking" className="space-y-4">
              <Card className="gap-0 p-6">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm",
                      CATEGORY_TILE[selectedService?.category ?? "MEDICAL"] ?? CATEGORY_TILE.MEDICAL
                    )}
                  >
                    {selectedService?.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{selectedService?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedService?.duration} min · {selectedService?.category}
                    </p>
                  </div>
                  <span className="ml-auto text-xl font-bold text-primary">
                    {formatBDT(selectedService?.price ?? 0)}
                  </span>
                </div>
                <Separator className="my-4" />
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Pet:</span>
                    <span className="font-medium">
                      {selectedPet ? `${petEmoji(selectedPet.type)} ${selectedPet.name}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="font-medium">{selectedProvider?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">{formatDate(date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium">{time ? formatTime(time) : "—"}</span>
                  </div>
                </dl>
                <div className="mt-4 grid gap-2">
                  <Label htmlFor="book-notes">Notes for the provider (optional)</Label>
                  <Textarea
                    id="book-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything the vet or groomer should know..."
                    rows={3}
                  />
                </div>
              </Card>
            </section>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* Nav buttons */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={step === 1 || submitting}
          className="min-h-11"
        >
          <ArrowLeft /> Back
        </Button>
        <div className="flex flex-col items-end gap-1">
          <StepHint show={!stepValid && step !== 5}>
            {step === 1
              ? "Select a service to continue"
              : step === 2
                ? "Select a pet to continue"
                : step === 3
                  ? "Select a provider to continue"
                  : "Pick a time slot to continue"}
          </StepHint>
          {step < 5 ? (
            <Button onClick={goNext} disabled={!stepValid} className="min-h-11">
              Next <ArrowRight />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={submitting || !serviceId || !petId || !providerId || !time} className="min-h-11">
              {submitting ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
              Confirm booking
            </Button>
          )}
        </div>
      </div>

      <InlineAddPetDialog
        open={addPetOpen}
        onOpenChange={setAddPetOpen}
        onCreated={(pet) => {
          setPets((prev) => (prev ? [...prev, pet] : [pet]));
          setPetId(pet.id);
        }}
      />
    </div>
  );
}
