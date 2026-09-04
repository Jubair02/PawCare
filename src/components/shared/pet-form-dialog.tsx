"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errMsg } from "@/lib/api";
import { MAX_PHOTO_BYTES, PET_TYPES, VACCINATION_STATUSES } from "@/lib/constants";
import { petEmoji } from "@/lib/formatters";
import type { PetDTO } from "@/lib/types";

/**
 * The one pet create/edit form.
 *
 * Replaces three near-identical dialogs (booking flow step 2, My Pets, pet
 * detail) that had drifted apart: one was missing the colour field, one could
 * not change the pet type, and only one of them could clear a field on save.
 * This is the superset of all three.
 *
 * Pass `pet` to edit, `null` to create.
 */

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

function formFromPet(pet: PetDTO): PetFormState {
  return {
    name: pet.name,
    type: String(pet.type),
    breed: pet.breed ?? "",
    gender: pet.gender ?? "MALE",
    birthDate: pet.birthDate ?? "",
    weight: pet.weight !== undefined && pet.weight !== null ? String(pet.weight) : "",
    color: pet.color ?? "",
    vaccinationStatus: pet.vaccinationStatus ?? "NONE",
    medicalNotes: pet.medicalNotes ?? "",
    photo: pet.photo ?? "",
  };
}

export function PetFormDialog({
  open,
  onOpenChange,
  pet = null,
  onSaved,
  idPrefix = "pet",
  successMessage,
  ownerId,
  ownerName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The pet being edited, or null/omitted to create a new one. */
  pet?: PetDTO | null;
  /**
   * Register the pet to this customer instead of the signed-in user. Staff and
   * admins use it to add a walk-in's pet; customers omit it.
   */
  ownerId?: string;
  /** The owner's name, for the dialog copy when `ownerId` is set. */
  ownerName?: string;
  /** Called after a successful save with the pet returned by the API. */
  onSaved: (pet: PetDTO) => void;
  /** Prefix for the field ids, so two of these can live on one page. */
  idPrefix?: string;
  /** Override the success toast (defaults to "<name> updated" / "<name> added to your family"). */
  successMessage?: (pet: PetDTO, editing: boolean) => string;
}) {
  const editing = !!pet;
  const [form, setForm] = useState<PetFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNameError(null);
    setForm(pet ? formFromPet(pet) : EMPTY_FORM);
  }, [open, pet]);

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
      // On edit, an emptied field must be sent as "" (or null for weight) so the
      // API clears it. Sending `undefined` omits the key, which the API skips —
      // that is why cleared fields silently kept their old value.
      const clearable = (v: string) => (editing ? v : v || undefined);
      const payload = {
        name: form.name.trim(),
        type: form.type,
        breed: clearable(form.breed.trim()),
        gender: form.gender,
        birthDate: clearable(form.birthDate),
        weight: form.weight ? Number(form.weight) : editing ? null : undefined,
        color: clearable(form.color.trim()),
        vaccinationStatus: form.vaccinationStatus,
        medicalNotes: clearable(form.medicalNotes.trim()),
        photo: clearable(form.photo),
        // Only sent on create: the API takes ownerId from staff/admin callers
        // and ignores it for customers, who can only add their own pets.
        ...(!editing && ownerId ? { ownerId } : {}),
      };
      const res = pet
        ? await apiFetch<{ pet: PetDTO }>(`/api/pets/${pet.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await apiFetch<{ pet: PetDTO }>("/api/pets", { method: "POST", body: payload });
      toast.success(
        successMessage
          ? successMessage(res.pet, editing)
          : editing
            ? `${res.pet.name} updated`
            : ownerName
              ? `${res.pet.name} registered to ${ownerName}`
              : `${res.pet.name} added to your family`
      );
      onOpenChange(false);
      onSaved(res.pet);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {pet ? `Edit ${pet.name}` : ownerName ? `Add a pet for ${ownerName}` : "Add a new pet"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update your pet's profile details."
              : ownerName
                ? `Register a new patient to ${ownerName}'s file.`
                : "Tell us about your companion so we can care for them better."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-name`}>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-name`}
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
              <Label htmlFor={`${idPrefix}-breed`}>Breed</Label>
              <Input
                id={`${idPrefix}-breed`}
                value={form.breed}
                onChange={(e) => set("breed", e.target.value)}
                placeholder="e.g. Golden Retriever"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-color`}>Color</Label>
              <Input
                id={`${idPrefix}-color`}
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
                <RadioGroupItem value="MALE" id={`${idPrefix}-gender-male`} />
                <Label htmlFor={`${idPrefix}-gender-male`} className="font-normal">
                  Male
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="FEMALE" id={`${idPrefix}-gender-female`} />
                <Label htmlFor={`${idPrefix}-gender-female`} className="font-normal">
                  Female
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-birth`}>Birth date</Label>
              <Input
                id={`${idPrefix}-birth`}
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-weight`}>Weight (kg)</Label>
              <Input
                id={`${idPrefix}-weight`}
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
            <Select
              value={form.vaccinationStatus}
              onValueChange={(v) => set("vaccinationStatus", v)}
            >
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
            <Label htmlFor={`${idPrefix}-notes`}>Medical notes</Label>
            <Textarea
              id={`${idPrefix}-notes`}
              value={form.medicalNotes}
              onChange={(e) => set("medicalNotes", e.target.value)}
              placeholder="Allergies, chronic conditions, medication..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-photo`}>Photo</Label>
            <div className="flex items-center gap-3">
              {form.photo ? (
                 
                <img
                  src={form.photo}
                  alt="Pet preview"
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 rounded-xl border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {petEmoji(form.type)}
                </div>
              )}
              <Input
                id={`${idPrefix}-photo`}
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="h-11"
              />
              {form.photo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => set("photo", "")}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 400KB.</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="min-h-11"
          >
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
