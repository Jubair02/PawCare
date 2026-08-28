"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  Droplet,
  Loader2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { PET_TYPES, VACCINATION_STATUSES } from "@/lib/constants";
import { formatDate, formatTime, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PetDetailDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";

const MAX_PHOTO_BYTES = 400 * 1024; // 400KB

function ageLabel(birthDate?: string): string | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const born = new Date(y, m - 1, d);
  if (born.getTime() > now.getTime()) return null;
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} mo old`;
  if (rem === 0) return `${years} yr old`;
  return `${years} yr ${rem} mo old`;
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium">
      {icon}
      {children}
    </span>
  );
}

function EditPetDialog({
  open,
  onOpenChange,
  pet,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pet: PetDetailDTO | null;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState("MALE");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [vaccinationStatus, setVaccinationStatus] = useState("NONE");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [photo, setPhoto] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (open && pet) {
      setName(pet.name);
      setBreed(pet.breed ?? "");
      setGender(pet.gender ?? "MALE");
      setBirthDate(pet.birthDate ?? "");
      setWeight(pet.weight !== undefined && pet.weight !== null ? String(pet.weight) : "");
      setColor(pet.color ?? "");
      setVaccinationStatus(pet.vaccinationStatus ?? "NONE");
      setMedicalNotes(pet.medicalNotes ?? "");
      setPhoto(pet.photo ?? "");
      setNameError(null);
    }
  }, [open, pet]);

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
    reader.onload = () => setPhoto(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setNameError("Pet name is required");
      return;
    }
    if (!pet) return;
    setSaving(true);
    try {
      await apiFetch<{ pet: PetDetailDTO }>(`/api/pets/${pet.id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          breed: breed.trim() || undefined,
          gender,
          birthDate: birthDate || undefined,
          weight: weight ? Number(weight) : undefined,
          color: color.trim() || undefined,
          vaccinationStatus,
          medicalNotes: medicalNotes.trim() || undefined,
          photo: photo || undefined,
        },
      });
      toast.success("Pet profile updated");
      onOpenChange(false);
      onSaved();
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
          <DialogTitle>Edit {pet?.name}</DialogTitle>
          <DialogDescription>Update your pet&apos;s profile details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="detail-pet-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="detail-pet-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={!!nameError}
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="detail-pet-breed">Breed</Label>
              <Input id="detail-pet-breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-pet-color">Color</Label>
              <Input id="detail-pet-color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Gender</Label>
            <RadioGroup value={gender} onValueChange={setGender} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="MALE" id="detail-gender-male" />
                <Label htmlFor="detail-gender-male" className="font-normal">
                  Male
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FEMALE" id="detail-gender-female" />
                <Label htmlFor="detail-gender-female" className="font-normal">
                  Female
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="detail-pet-birth">Birth date</Label>
              <Input
                id="detail-pet-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-pet-weight">Weight (kg)</Label>
              <Input
                id="detail-pet-weight"
                type="number"
                min="0"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Vaccination status</Label>
            <Select value={vaccinationStatus} onValueChange={setVaccinationStatus}>
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
            <Label htmlFor="detail-pet-notes">Medical notes</Label>
            <Textarea
              id="detail-pet-notes"
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="detail-pet-photo">Photo</Label>
            <div className="flex items-center gap-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt="Pet preview"
                  className="h-14 w-14 rounded-xl border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {pet ? petEmoji(pet.type) : "🐾"}
                </div>
              )}
              <Input
                id="detail-pet-photo"
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
          <Button onClick={handleSubmit} disabled={saving} className="min-h-11">
            {saving ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const age = ageLabel(pet.birthDate);

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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pet.photo}
                  alt={pet.name}
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
                <Chip>{petEmoji(pet.type)} {String(pet.type).replace(/_/g, " ")}</Chip>
                {pet.breed ? <Chip>{pet.breed}</Chip> : null}
                {pet.gender ? (
                  <Chip icon={<User className="size-3.5" />}>
                    {pet.gender === "MALE" ? "Male" : pet.gender === "FEMALE" ? "Female" : pet.gender}
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
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
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
                        <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
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

      <EditPetDialog open={editOpen} onOpenChange={setEditOpen} pet={pet} onSaved={loadPet} />
    </div>
  );
}
