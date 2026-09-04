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
  PawPrint,
  Search,
  UserPlus,
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
import { AppointmentDetailsDialog } from "@/components/shared/appointment-details-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PetFormDialog } from "@/components/shared/pet-form-dialog";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, errMsg } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  clinicToday,
  formatBDT,
  formatDate,
  formatDateShort,
  formatTime,
  initials,
  petEmoji,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AppointmentDTO, PageMeta, PaymentMethod, PetDTO, ProviderDTO, ServiceDTO, UserDTO } from "@/lib/types";

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

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
  const [date, setDate] = useState<string>(clinicToday());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Walk-in escape hatches: the wizard used to dead-end when the customer had
  // no pet on file, or was not registered at all.
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

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
    if (step !== 4 || !provider || !date || !service) return;
    let cancelled = false;
    setSlotsLoading(true);
    setTime("");
    apiFetch<{ slots: string[] }>(
      `/api/appointments/slots?providerId=${provider.id}&date=${date}&serviceId=${service.id}`
    )
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
  }, [step, provider, date, service]);

  const canNext =
    (step === 1 && customer !== null) ||
    (step === 2 && pet !== null) ||
    (step === 3 && service !== null && provider !== null);

  /** A pet just registered for this customer: list it and pre-select it. */
  function handlePetCreated(created: PetDTO) {
    setPets((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
    setPet(created);
  }

  /** A walk-in customer just registered: select them and move to their pet. */
  function handleCustomerCreated(created: UserDTO) {
    setCustomers((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
    setCustomer(created);
    setPet(null);
    setStep(2);
  }

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
    <>
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
          {/* A bare div takes no accessible name, so the label needs a role to
              hang off — otherwise screen readers announce nothing here. */}
          <div className="flex items-start gap-1" role="group" aria-label={`Step ${step} of 4`}>
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Search customers by name or email…"
                    className="pl-9"
                    aria-label="Search customers"
                  />
                </div>
                <Button
                  variant="outline"
                  className="min-h-11 shrink-0 sm:min-h-9"
                  onClick={() => setNewCustomerOpen(true)}
                >
                  <UserPlus className="size-4" /> New customer
                </Button>
              </div>
              {customersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : customers.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {customerDebounced
                      ? `No customer matches “${customerDebounced}”.`
                      : "No customers on file yet."}
                  </p>
                  <Button variant="outline" className="mt-3 min-h-10" onClick={() => setNewCustomerOpen(true)}>
                    <UserPlus className="size-4" /> Register a new customer
                  </Button>
                </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Pick <span className="font-semibold text-foreground">{customer.name}</span>&apos;s pet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-10 sm:min-h-9"
                  onClick={() => setAddPetOpen(true)}
                >
                  <PawPrint className="size-4" /> Add a pet
                </Button>
              </div>
              {petsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : pets.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {customer.name} has no pets on file yet.
                  </p>
                  <Button variant="outline" className="mt-3 min-h-10" onClick={() => setAddPetOpen(true)}>
                    <PawPrint className="size-4" /> Register their pet
                  </Button>
                </div>
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
                  min={clinicToday()}
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

      {/* Mounted outside the wizard's content so the two dialogs stack cleanly */}
      {customer ? (
        <PetFormDialog
          open={addPetOpen}
          onOpenChange={setAddPetOpen}
          ownerId={customer.id}
          ownerName={customer.name}
          idPrefix="staff-new-pet"
          onSaved={handlePetCreated}
        />
      ) : null}
      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCreated={handleCustomerCreated}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* New customer dialog (walk-ins with no account)                      */
/* ------------------------------------------------------------------ */

/**
 * Front-desk registration for someone who has never booked before.
 *
 * `POST /api/users` accepts STAFF only for the CUSTOMER role, so this cannot
 * create a colleague or a provider. The temporary password is handed to the
 * customer, who can change it from their profile.
 */
function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (user: UserDTO) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: "", email: "", phone: "", password: "" });
  }, [open]);

  async function save() {
    if (!form.name.trim()) {
      toast.error("The customer's name is required.");
      return;
    }
    if (!form.email.trim()) {
      toast.error("An email address is required — it is how they sign in.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("The temporary password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ user: UserDTO }>("/api/users", {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          role: "CUSTOMER",
          password: form.password,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        },
      });
      toast.success(`${res.user.name} registered`);
      onOpenChange(false);
      onCreated(res.user);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Register a customer
          </DialogTitle>
          <DialogDescription>
            Opens a file for a walk-in so you can book them straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="nc-name">Full name</Label>
            <Input
              id="nc-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rahim Uddin"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nc-email">Email</Label>
            <Input
              id="nc-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="rahim@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nc-phone">Phone (optional)</Label>
            <Input
              id="nc-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="01712345678"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nc-password">Temporary password</Label>
            <Input
              id="nc-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 6 characters"
            />
            <p className="text-xs text-muted-foreground">
              Give this to the customer — they can change it from their profile.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="min-w-32">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Register
          </Button>
        </DialogFooter>
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
      `/api/appointments/slots?providerId=${appointment.provider.id}&date=${date}&serviceId=${appointment.service.id}`
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
              min={clinicToday()}
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
            {formatBDT(appointment.price)}. Records money already received and marks the
            invoice paid.
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

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ appointments: AppointmentDTO[]; page?: PageMeta }>("/api/appointments");
      setAppointments(res.appointments);
      setPage(res.page ?? null);
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
          className="border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
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
          className="border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
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
          className="border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
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
    // Settling up after the appointment is the most common front-desk action.
    if (a.paymentStatus === "UNPAID" && a.status !== "CANCELLED") {
      push(
        "pay",
        <Button
          size={size}
          variant="outline"
          className="border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 hover:text-amber-800"
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
      <ListNotice page={page} noun="appointments" />

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
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => openDetails(a)}
                    onKeyDown={(e) => {
                      // The actions cell holds real buttons; Enter/Space there
                      // must activate the button, not also open the dialog.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetails(a);
                      }
                    }}
                    aria-label={`Open details for ${a.service.name} — ${a.pet.name}, ${a.customer.name}`}
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
                <Card
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer p-4 focus-visible:ring-2 focus-visible:ring-primary"
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
                  aria-label={`Open details for ${a.service.name} — ${a.pet.name}, ${a.customer.name}`}
                >
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
      <AppointmentDetailsDialog
        appointment={details}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        busy={busyId !== null}
        actions={details ? actionButtons(details, "default") : null}
        showPrice
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
