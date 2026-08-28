"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Cake,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Syringe,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { PET_TYPES, VACCINATION_STATUSES } from "@/lib/constants";
import { formatDate, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PetDTO } from "@/lib/types";
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

interface PetFormState {
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

const EMPTY_FORM: PetFormState = {
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

function PetFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PetDTO | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PetFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNameError(null);
      if (editing) {
        setForm({
          name: editing.name,
          type: editing.type,
          breed: editing.breed ?? "",
          gender: editing.gender ?? "MALE",
          birthDate: editing.birthDate ?? "",
          weight: editing.weight !== undefined && editing.weight !== null ? String(editing.weight) : "",
          color: editing.color ?? "",
          vaccinationStatus: editing.vaccinationStatus ?? "NONE",
          medicalNotes: editing.medicalNotes ?? "",
          photo: editing.photo ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editing]);

  const set = (key: keyof PetFormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

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

  async function handleSubmit() {
    if (!form.name.trim()) {
      setNameError("Pet name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
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
      };
      if (editing) {
        await apiFetch<{ pet: PetDTO }>(`/api/pets/${editing.id}`, { method: "PATCH", body: payload });
        toast.success(`${payload.name} updated`);
      } else {
        await apiFetch<{ pet: PetDTO }>("/api/pets", { method: "POST", body: payload });
        toast.success(`${payload.name} added to your family`);
      }
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
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a new pet"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update your pet's profile details."
              : "Tell us about your companion so we can care for them better."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pet-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pet-name"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pet-breed">Breed</Label>
              <Input
                id="pet-breed"
                value={form.breed}
                onChange={(e) => set("breed", e.target.value)}
                placeholder="e.g. Golden Retriever"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pet-color">Color</Label>
              <Input
                id="pet-color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="e.g. Golden"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Gender</Label>
            <RadioGroup
              value={form.gender}
              onValueChange={(v) => set("gender", v)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="MALE" id="gender-male" />
                <Label htmlFor="gender-male" className="font-normal">
                  Male
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FEMALE" id="gender-female" />
                <Label htmlFor="gender-female" className="font-normal">
                  Female
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pet-birth">Birth date</Label>
              <Input
                id="pet-birth"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pet-weight">Weight (kg)</Label>
              <Input
                id="pet-weight"
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
            <Label htmlFor="pet-notes">Medical notes</Label>
            <Textarea
              id="pet-notes"
              value={form.medicalNotes}
              onChange={(e) => set("medicalNotes", e.target.value)}
              placeholder="Allergies, chronic conditions, medication..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pet-photo">Photo</Label>
            <div className="flex items-center gap-3">
              {form.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                id="pet-photo"
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
            {editing ? "Save changes" : "Add pet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PetCard({
  pet,
  onOpen,
  onEdit,
  onDelete,
}: {
  pet: PetDTO;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const age = ageLabel(pet.birthDate);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="group h-full cursor-pointer gap-0 p-0 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="relative h-32 w-full overflow-hidden rounded-t-2xl">
          {pet.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.photo} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-500 text-5xl">
              {petEmoji(pet.type)}
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{pet.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 text-xs font-medium">
                  {petEmoji(pet.type)} {String(pet.type).replace(/_/g, " ")}
                </span>
                {pet.breed ? (
                  <span className="truncate text-xs text-muted-foreground">{pet.breed}</span>
                ) : null}
              </div>
            </div>
            <StatusBadge status={pet.vaccinationStatus ?? "NONE"} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {age ? (
              <span className="flex items-center gap-1">
                <Cake className="size-3.5" /> {age}
              </span>
            ) : null}
            {pet.weight !== undefined && pet.weight !== null ? (
              <span className="flex items-center gap-1">
                <Scale className="size-3.5" /> {pet.weight} kg
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {pet._count?.appointments ?? 0} visits
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={`Delete ${pet.name}`}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function PetsView() {
  const setView = useAppStore((s) => s.setView);
  const setSelectedPetId = useAppStore((s) => s.setSelectedPetId);
  const [pets, setPets] = useState<PetDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PetDTO | null>(null);
  const [deleting, setDeleting] = useState<PetDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  async function loadPets() {
    setLoading(true);
    try {
      const res = await apiFetch<{ pets: PetDTO[] }>("/api/pets");
      setPets(res.pets);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPets();
  }, []);

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/pets/${deleting.id}`, { method: "DELETE" });
      toast.success(`${deleting.name} removed`);
      setDeleting(null);
      loadPets();
    } catch (err) {
      const message = (err as Error).message;
      toast.error(message.includes("409") ? "Pet has appointment history" : message);
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="My Pets" description="Your companions and their care profiles">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="min-h-11"
        >
          <Plus /> Add pet
        </Button>
      </SectionHeader>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="gap-0 p-0">
              <Skeleton className="h-32 w-full rounded-b-none rounded-t-2xl" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : pets && pets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              onOpen={() => {
                setSelectedPetId(pet.id);
                setView("cust-pet-detail");
              }}
              onEdit={() => {
                setEditing(pet);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleting(pet)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<PawPrint />}
          title="No pets yet"
          description="Add your first companion to start booking vet visits and grooming sessions."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="min-h-11"
            >
              <Plus /> Add your first pet
            </Button>
          }
        />
      )}

      <PetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={loadPets}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the pet profile and its medical data. Pets with
              appointment history cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending} className="min-h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deletePending}
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
            >
              {deletePending ? <Loader2 className="animate-spin" /> : null}
              Delete pet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
