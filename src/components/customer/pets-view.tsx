"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Cake,
  Loader2,
  PawPrint,
  Pencil,
  Plus,
  Scale,
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errMsg } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { petAge, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PageMeta, PetDTO } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";
import { PetFormDialog } from "@/components/shared/pet-form-dialog";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";

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
  const age = petAge(pet.birthDate);
  const visits = pet._count?.appointments ?? 0;
  // DELETE /api/pets/:id refuses a pet with appointments (409), so the button is
  // only offered when it can actually succeed.
  const canDelete = visits === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      {/* The open-detail region and the row of buttons are siblings: nesting
          real buttons inside a clickable card made the actions unreachable in a
          predictable order for keyboard users. */}
      <Card className="group h-full gap-0 p-0 transition-shadow hover:shadow-md">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${pet.name}'s profile`}
          className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="relative h-32 w-full overflow-hidden rounded-t-2xl">
            {pet.photo ? (

              <img src={pet.photo} alt={pet.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-500 text-5xl">
                {petEmoji(pet.type)}
              </div>
            )}
          </div>
          <div className="p-4 pb-0">
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
                <CalendarDays className="size-3.5" /> {visits} visits
              </span>
            </div>
          </div>
        </button>

        <div className="px-4 pb-4">
          <div className="mt-4 flex items-center gap-2 border-t pt-3">
            <Button size="sm" variant="outline" className="min-h-11 flex-1" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
            {canDelete ? (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                aria-label={`Delete ${pet.name}`}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
          {canDelete ? null : (
            <p className="mt-2 text-xs text-muted-foreground">
              {pet.name} has visit history, so the profile is kept with those records and cannot be
              deleted.
            </p>
          )}
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

  const [page, setPage] = useState<PageMeta | null>(null);

  async function loadPets() {
    setLoading(true);
    try {
      const res = await apiFetch<{ pets: PetDTO[]; page?: PageMeta }>("/api/pets");
      setPets(res.pets);
      setPage(res.page ?? null);
    } catch (err) {
      toast.error(errMsg(err));
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
      toast.error(errMsg(err));
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
      <ListNotice page={page} noun="pets" />

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
        pet={editing}
        onSaved={loadPets}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the profile — name, breed, photo, weight and notes. Only
              pets with no visits can be deleted, so there is no appointment or treatment history
              to lose. This cannot be undone.
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
