"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleCheck,
  Eye,
  Loader2,
  LogIn,
  Play,
  Receipt,
  Search,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  formatBDT,
  formatDate,
  formatDateShort,
  formatTime,
  initials,
  petEmoji,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  AppointmentDTO,
  PaymentMethod,
  PetDTO,
  ProviderDTO,
  ServiceDTO,
  UserDTO,
} from "@/lib/types";

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Details dialog                                                      */
/* ------------------------------------------------------------------ */

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
              <DetailRow label="Customer">
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
              <DetailRow label="Pet">
                {petEmoji(appointment.pet.type)} {appointment.pet.name}
                {appointment.pet.breed ? ` · ${appointment.pet.breed}` : ""}
              </DetailRow>
              <DetailRow label="Provider">{appointment.provider.name}</DetailRow>
              <DetailRow label="Duration">{appointment.service.duration} min</DetailRow>
              <DetailRow label="Price">{formatBDT(appointment.price)}</DetailRow>
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
/* Create wizard dialog                                                */
/* ------------------------------------------------------------------ */

const WIZARD_STEPS = ["Customer", "Pet", "Service", "Schedule"];

function CreateAppointmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);

  // (a) customer
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerDebounced, setCustomerDebounced] = useState("");
  const [customers, setCustomers] = useState<UserDTO[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customer, setCustomer] = useState<UserDTO | null>(null);

  // (b) pet
  const [pets, setPets] = useState<PetDTO[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [pet, setPet] = useState<PetDTO | null>(null);

  // (c) service + provider
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [service, setService] = useState<ServiceDTO | null>(null);
  const [providers, setProviders] = useState<ProviderDTO[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [provider, setProvider] = useState<ProviderDTO | null>(null);

  // (d) date + slot + notes
  const [date, setDate] = useState<string>(todayStr());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounce the customer search (300ms)
  useEffect(() => {
    const t = setTimeout(() => setCustomerDebounced(customerQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  // Load customers for step 1
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCustomersLoading(true);
    const params = new URLSearchParams({ role: "CUSTOMER" });
    if (customerDebounced) params.set("q", customerDebounced);
    apiFetch<{ users: UserDTO[] }>(`/api/users?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setCustomers(res.users);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerDebounced]);

  // Load pets when a customer is picked (step 2)
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setPetsLoading(true);
    apiFetch<{ pets: PetDTO[] }>(`/api/pets?ownerId=${customer.id}`)
      .then((res) => {
        if (!cancelled) setPets(res.pets);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setPetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  // Load active services once (step 3)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setServicesLoading(true);
    apiFetch<{ services: ServiceDTO[] }>("/api/services?active=true")
      .then((res) => {
        if (!cancelled) setServices(res.services);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Load providers matching the service category (step 3)
  useEffect(() => {
    if (!service) return;
    const specialty = service.category === "GROOMING" ? "GROOMER" : "VET";
    let cancelled = false;
    setProvider(null);
    setProvidersLoading(true);
    apiFetch<{ providers: ProviderDTO[] }>(`/api/providers?specialty=${specialty}`)
      .then((res) => {
        if (!cancelled) setProviders(res.providers);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  // Load slots for the chosen provider + date (step 4)
  useEffect(() => {
    if (step !== 4 || !provider || !date) return;
    let cancelled = false;
    setSlotsLoading(true);
    setTime("");
    apiFetch<{ slots: string[] }>(`/api/appointments/slots?providerId=${provider.id}&date=${date}`)
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
      })
      .catch((e) => {
        if (!cancelled) {
          setSlots([]);
          toast.error(errMsg(e));
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, provider, date]);

  const canNext =
    (step === 1 && customer !== null) ||
    (step === 2 && pet !== null) ||
    (step === 3 && service !== null && provider !== null);

  async function submit() {
    if (!customer || !pet || !service || !provider || !date || !time) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/appointments", {
        method: "POST",
        body: {
          customerId: customer.id,
          petId: pet.id,
          serviceId: service.id,
          providerId: provider.id,
          date,
          time,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      toast.success("Appointment created");
      onOpenChange(false);
      onCreated();
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
            <CalendarPlus className="size-5 text-primary" />
            New appointment
          </DialogTitle>
          <DialogDescription>Book on behalf of a customer, step by step.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-start gap-1" aria-label={`Step ${step} of 4`}>
          {WIZARD_STEPS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-primary/15 text-primary",
                    !active && !done && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-4" /> : n}
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-xs",
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1 — customer */}
        {step === 1 ? (
          <div className="grid gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search customers by name or email…"
                className="pl-9"
                aria-label="Search customers"
              />
            </div>
            {customersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : customers.length === 0 ? (
              <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
                No customers found.
              </p>
            ) : (
              <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                {customers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setCustomer(u);
                      setPet(null);
                      setStep(2);
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                      customer?.id === u.id && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(u.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {u._count?.pets ?? 0} pet{(u._count?.pets ?? 0) === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Step 2 — pet */}
        {step === 2 && customer ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Pick <span className="font-semibold text-foreground">{customer.name}</span>&apos;s pet.
            </p>
            {petsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : pets.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-amber-50/60 px-4 py-6 text-center text-sm text-amber-800">
                This customer has no pets — they must add one first.
              </p>
            ) : (
              <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPet(p)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                      pet?.id === p.id && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                      {petEmoji(p.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.breed ?? "—"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Step 3 — service + provider */}
        {step === 3 ? (
          <div className="grid gap-3">
            <p className="text-sm font-semibold">Service</p>
            {servicesLoading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setService(s)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                      service?.id === s.id && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{s.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatBDT(s.price)} · {s.duration} min · {s.category.toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-sm font-semibold">Provider</p>
            {!service ? (
              <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                Pick a service first — the provider list follows its category.
              </p>
            ) : providersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : providers.length === 0 ? (
              <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                No active {service.category === "GROOMING" ? "groomers" : "vets"} available.
              </p>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                      provider?.id === p.id && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.specialty === "GROOMER" ? "Groomer" : "Veterinarian"}
                        {p.rating ? ` · ★ ${p.rating}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Step 4 — date + slot + notes */}
        {step === 4 && provider ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="appt-date">Date</Label>
              <Input
                id="appt-date"
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Available slots</Label>
              {slotsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-24 rounded-lg" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                  No free slots on this day — try another date.
                </p>
              ) : (
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                  {slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTime(s)}
                      className={cn(
                        "min-h-9 rounded-lg border px-3 font-mono text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5",
                        time === s && "border-primary bg-primary text-primary-foreground hover:bg-primary"
                      )}
                    >
                      {formatTime(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appt-notes">Notes (optional)</Label>
              <Textarea
                id="appt-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the provider should know"
              />
            </div>
          </div>
        ) : null}

        {/* Wizard footer */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="min-h-11 sm:min-h-9"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button
              className="min-h-11 sm:min-h-9"
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Next
            </Button>
          ) : (
            <Button
              className="min-h-11 sm:min-h-9"
              disabled={!time || submitting}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
              Create appointment
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Reschedule dialog (PENDING only)                                    */
/* ------------------------------------------------------------------ */

function RescheduleDialog({
  appointment,
  onOpenChange,
  onSaved,
}: {
  appointment: AppointmentDTO;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    apiFetch<{ slots: string[] }>(
      `/api/appointments/slots?providerId=${appointment.provider.id}&date=${date}`
    )
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointment, date]);

  async function save() {
    if (!date || !time) return;
    setSaving(true);
    try {
      await apiFetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        body: { date, time },
      });
      toast.success("Appointment rescheduled");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            Reschedule — {appointment.pet.name}
          </DialogTitle>
          <DialogDescription>
            Currently {formatDate(appointment.date)} at {formatTime(appointment.time)} with{" "}
            {appointment.provider.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="rs-date">New date</Label>
            <Input
              id="rs-date"
              type="date"
              value={date}
              min={todayStr()}
              onChange={(e) => {
                setDate(e.target.value);
                setTime("");
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>New time</Label>
            {slotsLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-24 rounded-lg" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                No free slots on this day — try another date.
              </p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setTime(s)}
                    className={cn(
                      "min-h-9 rounded-lg border px-3 font-mono text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5",
                      time === s && "border-primary bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {formatTime(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-11 sm:min-h-9" disabled={!time || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
            Save new time
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Record payment dialog                                               */
/* ------------------------------------------------------------------ */

function PaymentDialog({
  appointment,
  onOpenChange,
  onSaved,
}: {
  appointment: AppointmentDTO;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);

  async function pay() {
    setSubmitting(true);
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        body: { appointmentId: appointment.id, method },
      });
      toast.success(`Payment recorded for ${appointment.pet.name}`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            Record payment
          </DialogTitle>
          <DialogDescription>
            {appointment.service.icon} {appointment.service.name} for {appointment.pet.name} ·{" "}
            {formatBDT(appointment.price)}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="gap-2">
          {PAYMENT_METHODS.map((m) => (
            <Label
              key={m.value}
              htmlFor={`pay-${m.value}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors hover:bg-muted/60",
                method === m.value && "border-primary bg-primary/5"
              )}
            >
              <RadioGroupItem id={`pay-${m.value}`} value={m.value} />
              <span className="text-sm font-medium">{m.label}</span>
            </Label>
          ))}
        </RadioGroup>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button className="min-h-11 sm:min-h-9" disabled={submitting} onClick={() => void pay()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
            Mark paid · {formatBDT(appointment.price)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function StaffAppointmentsView() {
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [details, setDetails] = useState<AppointmentDTO | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDTO | null>(null);
  const [payTarget, setPayTarget] = useState<AppointmentDTO | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    a: AppointmentDTO;
    kind: "decline" | "cancel";
  } | null>(null);

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

  const filtered = useMemo(() => {
    let list = appointments;
    if (statusFilter !== "ALL") list = list.filter((a) => a.status === statusFilter);
    if (dateFilter) list = list.filter((a) => a.date === dateFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (a) =>
          a.customer.name.toLowerCase().includes(needle) ||
          a.pet.name.toLowerCase().includes(needle) ||
          a.service.name.toLowerCase().includes(needle)
      );
    }
    return list;
  }, [appointments, statusFilter, dateFilter, q]);

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

  function actionButtons(a: AppointmentDTO, size: "sm" | "default" = "sm"): React.ReactNode[] {
    const disabled = busyId === a.id;
    const btns: React.ReactNode[] = [];
    const push = (key: string, node: React.ReactNode) => btns.push(<span key={key}>{node}</span>);

    if (a.status === "PENDING") {
      push(
        "confirm",
        <Button
          size={size}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            void setStatus(a, "CONFIRMED", "Appointment confirmed");
          }}
        >
          {disabled ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
          Confirm
        </Button>
      );
      push(
        "reschedule",
        <Button
          size={size}
          variant="outline"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setRescheduleTarget(a);
          }}
        >
          <CalendarClock className="size-4" />
          Reschedule
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
            setCancelTarget({ a, kind: "decline" });
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
            setCancelTarget({ a, kind: "cancel" });
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
      push(
        "cancel",
        <Button
          size={size}
          variant="outline"
          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setCancelTarget({ a, kind: "cancel" });
          }}
        >
          <Ban className="size-4" />
          Cancel
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
    }
    if (a.paymentStatus === "UNPAID" && a.status !== "CANCELLED" && a.status !== "COMPLETED") {
      push(
        "pay",
        <Button
          size={size}
          variant="outline"
          className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setPayTarget(a);
          }}
        >
          <Receipt className="size-4" />
          Payment
        </Button>
      );
    }
    return btns;
  }

  function openDetails(a: AppointmentDTO) {
    setDetails(a);
    setDetailsOpen(true);
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Appointments"
        description="The front-desk operations hub — confirm, check in, reschedule, complete and collect."
      >
        <Button className="min-h-11 sm:min-h-9" onClick={() => setCreateOpen(true)}>
          <CalendarPlus className="size-4" />
          New appointment
        </Button>
      </SectionHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-40"
            aria-label="Filter by date"
          />
          {dateFilter ? (
            <Button variant="ghost" className="min-h-11 sm:min-h-9" onClick={() => setDateFilter("")}>
              Clear
            </Button>
          ) : null}
        </div>
        <div className="relative w-full lg:ml-auto lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, pet or service…"
            className="pl-9"
            aria-label="Search appointments"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No appointments found"
          description={
            q || dateFilter || statusFilter !== "ALL"
              ? "Nothing matches the current filters — try clearing them."
              : "Book the first appointment with the button above."
          }
        />
      ) : (
        <>
          {/* Table — md and up */}
          <div className="hidden overflow-x-auto rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => openDetails(a)}
                  >
                    <TableCell>
                      <span className="block font-medium">{formatDateShort(a.date)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatTime(a.time)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-36 truncate font-medium">{a.customer.name}</span>
                      {a.customer.phone ? (
                        <span className="block text-xs text-muted-foreground">{a.customer.phone}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="max-w-28 truncate">
                        {petEmoji(a.pet.type)} {a.pet.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-40 truncate">
                        {a.service.icon} {a.service.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="max-w-32 truncate text-muted-foreground">
                        {a.provider.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatBDT(a.price)}</TableCell>
                    <TableCell>
                      <div
                        className="flex max-w-56 flex-wrap items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actionButtons(a)}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetails(a);
                          }}
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">Details</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards — mobile */}
          <div className="space-y-3 md:hidden">
            {filtered.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="cursor-pointer p-4" onClick={() => openDetails(a)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 flex-col items-center rounded-xl bg-primary/10 px-3 py-2">
                        <span className="font-mono text-sm font-bold text-primary">
                          {formatTime(a.time)}
                        </span>
                        <span className="text-[11px] text-primary/70">{formatDateShort(a.date)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {a.service.icon} {a.service.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {petEmoji(a.pet.type)} {a.pet.name} · {a.customer.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          with {a.provider.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={a.status} />
                      <StatusBadge status={a.paymentStatus} />
                      <span className="text-sm font-semibold">{formatBDT(a.price)}</span>
                    </div>
                  </div>
                  <div
                    className="mt-3 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionButtons(a)}
                    <span className="grow" />
                    <Button size="sm" variant="ghost" onClick={() => openDetails(a)}>
                      <Eye className="size-4" />
                      Details
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Create wizard */}
      {createOpen ? (
        <CreateAppointmentDialog
          key="create-appointment"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => void load()}
        />
      ) : null}

      {/* Details */}
      <DetailsDialog
        appointment={details}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        busy={busyId !== null}
        actions={details ? actionButtons(details, "default") : null}
      />

      {/* Reschedule */}
      {rescheduleTarget ? (
        <RescheduleDialog
          key={rescheduleTarget.id}
          appointment={rescheduleTarget}
          onOpenChange={(v) => !v && setRescheduleTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {/* Record payment */}
      {payTarget ? (
        <PaymentDialog
          key={payTarget.id}
          appointment={payTarget}
          onOpenChange={(v) => !v && setPayTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {/* Decline / cancel confirmation */}
      <AlertDialog open={cancelTarget !== null} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelTarget?.kind === "decline" ? "Decline this request?" : "Cancel this appointment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.kind === "decline"
                ? `${cancelTarget.a.customer.name}'s request for ${cancelTarget.a.pet.name} (${cancelTarget.a.service.name}) will be declined and the customer notified.`
                : `${cancelTarget?.a.service.name} for ${cancelTarget?.a.pet.name} on ${formatDate(cancelTarget?.a.date ?? "")} will be cancelled and the customer notified.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (cancelTarget)
                  void setStatus(cancelTarget.a, "CANCELLED", "Appointment cancelled");
              }}
            >
              {cancelTarget?.kind === "decline" ? "Decline" : "Cancel appointment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
