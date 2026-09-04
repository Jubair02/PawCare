"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  Droplet,
  Palette,
  PawPrint,
  Pencil,
  Scale,
  Stethoscope,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { genderLabel, petTypeLabel } from "@/lib/constants";
import { formatDate, formatTime, petAge, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PetDetailDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PetFormDialog } from "@/components/shared/pet-form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium">
      {icon}
      {children}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export function PetDetailView() {
  const setView = useAppStore((s) => s.setView);
  const selectedPetId = useAppStore((s) => s.selectedPetId);
  const [pet, setPet] = useState<PetDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const loadPet = useCallback(async () => {
    if (!selectedPetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ pet: PetDetailDTO }>(`/api/pets/${selectedPetId}`);
      setPet(res.pet);
    } catch (err) {
      toast.error((err as Error).message);
      setPet(null);
    } finally {
      setLoading(false);
    }
  }, [selectedPetId]);

  useEffect(() => {
    loadPet();
  }, [loadPet]);

  if (loading) return <DetailSkeleton />;

  if (!selectedPetId || !pet) {
    return (
      <EmptyState
        icon={<PawPrint />}
        title="No pet selected"
        description="Pick one of your pets to see their profile and history."
        action={
          <Button onClick={() => setView("cust-pets")} className="min-h-11">
            <ArrowLeft /> Go to My Pets
          </Button>
        }
      />
    );
  }

  const age = petAge(pet.birthDate);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setView("cust-pets")} className="min-h-11 pl-2">
        <ArrowLeft /> Back to My Pets
      </Button>

      {/* Profile header card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="gap-0 p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="shrink-0">
              {pet.photo ? (
                 
                <img
                  src={pet.photo}
                  alt={pet.name}
                  loading="lazy"
                  decoding="async"
                  className="h-32 w-32 rounded-2xl border object-cover shadow-sm"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-6xl shadow-sm"
                  )}
                >
                  {petEmoji(pet.type)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{pet.name}</h1>
                <StatusBadge status={pet.vaccinationStatus ?? "NONE"} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip>{petEmoji(pet.type)} {petTypeLabel(pet.type)}</Chip>
                {pet.breed ? <Chip>{pet.breed}</Chip> : null}
                {pet.gender ? (
                  <Chip icon={<User className="size-3.5" />}>
                    {genderLabel(pet.gender)}
                  </Chip>
                ) : null}
                {pet.birthDate ? (
                  <Chip icon={<Cake className="size-3.5" />}>
                    Born {formatDate(pet.birthDate)}
                    {age ? ` (${age})` : ""}
                  </Chip>
                ) : null}
                {pet.weight !== undefined && pet.weight !== null ? (
                  <Chip icon={<Scale className="size-3.5" />}>{pet.weight} kg</Chip>
                ) : null}
                {pet.color ? (
                  <Chip icon={<Palette className="size-3.5" />}>{pet.color}</Chip>
                ) : null}
              </div>
              {pet.medicalNotes ? (
                <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    <Droplet className="size-3.5" /> Medical notes
                  </p>
                  <p className="mt-1 text-sm text-amber-900/90">{pet.medicalNotes}</p>
                </div>
              ) : null}
              <div className="mt-4">
                <Button onClick={() => setEditOpen(true)} variant="outline" className="min-h-11">
                  <Pencil /> Edit profile
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* History tabs */}
      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="appointments" className="min-h-11 gap-1.5">
            <CalendarDays className="size-4" /> Appointments
          </TabsTrigger>
          <TabsTrigger value="treatments" className="min-h-11 gap-1.5">
            <Stethoscope className="size-4" /> Treatments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="mt-4">
          {pet.appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="No appointments yet"
              description={`Book a service for ${pet.name} and it will appear here.`}
              action={
                <Button onClick={() => setView("cust-book")} className="min-h-11">
                  Book appointment
                </Button>
              }
            />
          ) : (
            <Card className="gap-0 p-2">
              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                {pet.appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                      {appt.service.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{appt.service.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{appt.provider.name}</p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm font-medium">{formatDate(appt.date)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(appt.time)}</p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="treatments" className="mt-4">
          {pet.treatments.length === 0 ? (
            <EmptyState
              icon={<Stethoscope />}
              title="No treatment records yet"
              description={`When a vet or groomer records a treatment for ${pet.name}, it will show up here.`}
            />
          ) : (
            <div className="grid max-h-96 grid-cols-1 gap-4 overflow-y-auto pr-1 scrollbar-thin lg:grid-cols-2">
              {pet.treatments.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="h-full gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <CalendarDays className="size-4 text-primary" />
                        {formatDate(t.appointment.date)} · {formatTime(t.appointment.time)}
                      </p>
                      <span className="truncate text-xs text-muted-foreground">
                        {t.provider.name}
                      </span>
                    </div>
                    {t.diagnosis ? (
                      <p className="text-sm font-bold">{t.diagnosis}</p>
                    ) : null}
                    {t.symptoms ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Symptoms:</span> {t.symptoms}
                      </p>
                    ) : null}
                    {t.treatmentPlan ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Plan:</span> {t.treatmentPlan}
                      </p>
                    ) : null}
                    {t.prescription ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Prescription:</span>{" "}
                        {t.prescription}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.medication ? (
                        <span className="rounded-full border bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {t.medication}
                          {t.dosage ? ` · ${t.dosage}` : ""}
                        </span>
                      ) : null}
                      {t.dosage && !t.medication ? (
                        <span className="rounded-full border bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {t.dosage}
                        </span>
                      ) : null}
                      {t.followUpDate ? (
                        <span className="rounded-full border border-amber-200 dark:border-amber-900 bg-amber-100 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                          Follow-up: {formatDate(t.followUpDate)}
                        </span>
                      ) : null}
                    </div>
                    {t.notes ? (
                      <p className="text-xs text-muted-foreground">{t.notes}</p>
                    ) : null}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PetFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        pet={pet}
        onSaved={loadPet}
        idPrefix="pet-detail"
      />
    </div>
  );
}
