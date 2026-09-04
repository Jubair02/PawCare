"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PawPrint, Search, Stethoscope } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DetailRow } from "@/components/shared/detail-row";
import { apiFetch, errMsg } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { genderLabel, petTypeLabel } from "@/lib/constants";
import { formatDate, petAge, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PageMeta, PetDTO, TreatmentDTO } from "@/lib/types";

export function VetPatientsView() {
  const user = useAppStore((s) => s.user);
  const [pets, setPets] = useState<PetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PetDTO | null>(null);
  const [treatments, setTreatments] = useState<TreatmentDTO[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isVet = user?.role === "VET";

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ pets: PetDTO[]; page?: PageMeta }>("/api/pets");
      setPets(res.pets);
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

  // Treatment history for the selected patient (fetched when dialog opens)
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setTreatments([]);
    setHistoryLoading(true);
    apiFetch<{ treatments: TreatmentDTO[] }>(`/api/treatments?petId=${selected.id}`)
      .then((res) => {
        if (!cancelled) setTreatments(res.treatments);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pets;
    return pets.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.breed ?? "").toLowerCase().includes(needle) ||
        (p.owner?.name ?? "").toLowerCase().includes(needle)
    );
  }, [pets, q]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isVet ? "Patients" : "Grooming clients"}
        description={
          isVet
            ? "Pets you have treated — open a card for profile and treatment history."
            : "Pets you groom — open a card for profile and session records."
        }
      >
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, breed or owner…"
            className="pl-9"
            aria-label="Search patients"
          />
      <ListNotice page={page} noun="patients" />
        </div>
      </SectionHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PawPrint />}
          title={q ? "No matching patients" : isVet ? "No patients yet" : "No clients yet"}
          description={
            q
              ? "Try a different name, breed or owner."
              : "Pets you have appointments with will appear here automatically."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                role="button"
                tabIndex={0}
                className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setSelected(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(p);
                  }
                }}
                aria-label={`Open profile for ${p.name}`}
              >
                <div className="flex items-start gap-3">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="size-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-2xl text-white">
                      {petEmoji(p.type)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{p.name}</p>
                      <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
                        {petTypeLabel(p.type)}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{p.breed ?? "—"}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Owner · {p.owner?.name ?? "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {p._count?.appointments ?? 0} visit{(p._count?.appointments ?? 0) === 1 ? "" : "s"}
                  </span>
                  <StatusBadge status={p.vaccinationStatus ?? ""} />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Patient profile + treatment history */}
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-lg">{petEmoji(selected.type)}</span>
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  {selected.breed ? `${selected.breed} · ` : ""}
                  {petTypeLabel(selected.type)} · Owner {selected.owner?.name ?? "Unknown"}
                </DialogDescription>
              </DialogHeader>

              <div>
                <DetailRow label="Gender">{genderLabel(selected.gender)}</DetailRow>
                <DetailRow label="Age">
                  {petAge(selected.birthDate) ?? "—"}
                  {selected.birthDate ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Born {formatDate(selected.birthDate)}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Weight">
                  {selected.weight != null ? `${selected.weight} kg` : "—"}
                </DetailRow>
                <DetailRow label="Color">{selected.color ?? "—"}</DetailRow>
                <DetailRow label="Vaccination">
                  <StatusBadge status={selected.vaccinationStatus ?? ""} />
                </DetailRow>
                {selected.medicalNotes ? (
                  <DetailRow label="Medical notes">
                    <span className="block max-w-xs whitespace-pre-wrap text-left text-sm font-normal text-muted-foreground">
                      {selected.medicalNotes}
                    </span>
                  </DetailRow>
                ) : null}
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Stethoscope className="size-4 text-primary" />
                  {isVet ? "Treatment history" : "Service records"}
                </p>
                {historyLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading records…
                  </div>
                ) : treatments.length === 0 ? (
                  <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
                    No records yet for this pet.
                  </p>
                ) : (
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                    {treatments.map((t) => (
                      <div key={t.id} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {formatDate(t.appointment.date)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.provider.specialty === "GROOMER" ? "Groomer" : "Dr."} {t.provider.name}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">
                          {t.diagnosis || <span className="text-muted-foreground">No diagnosis recorded</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
