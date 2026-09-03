"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Clock,
  Pill,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { formatDate, formatTime, petEmoji } from "@/lib/formatters";
import type { PageMeta, TreatmentDTO } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";

interface PetGroup {
  pet: TreatmentDTO["pet"];
  items: TreatmentDTO[];
}

function providerLabel(specialty?: string): string {
  return specialty === "GROOMER" ? "Groomer" : "Veterinarian";
}

function TreatmentCard({ t }: { t: TreatmentDTO }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="gap-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" />
            {formatDate(t.appointment.date)} · {formatTime(t.appointment.time)}
          </p>
          <StatusBadge status={t.appointment.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {providerLabel(t.provider.specialty)}: {t.provider.name}
        </p>

        {t.diagnosis ? (
          <p className="mt-3 flex items-start gap-2 text-sm font-semibold">
            <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
            {t.diagnosis}
          </p>
        ) : null}

        {t.symptoms || t.treatmentPlan || t.prescription ? (
          <dl className="mt-3 space-y-2 text-sm">
            {t.symptoms ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Symptoms</dt>
                <dd className="mt-0.5">{t.symptoms}</dd>
              </div>
            ) : null}
            {t.treatmentPlan ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Treatment plan</dt>
                <dd className="mt-0.5">{t.treatmentPlan}</dd>
              </div>
            ) : null}
            {t.prescription ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prescription</dt>
                <dd className="mt-0.5">{t.prescription}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {t.medication || t.dosage || t.followUpDate ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {t.medication ? (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium">
                <Pill className="size-3.5" /> {t.medication}
              </span>
            ) : null}
            {t.dosage ? (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-1 text-xs font-medium">
                <Clock className="size-3.5" /> {t.dosage}
              </span>
            ) : null}
            {t.followUpDate ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-900 bg-amber-100 dark:bg-amber-950/50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                <CalendarClock className="size-3.5" /> Follow-up: {formatDate(t.followUpDate)}
              </span>
            ) : null}
          </div>
        ) : null}

        {t.notes ? (
          <p className="mt-3 border-t pt-3 text-sm italic text-muted-foreground">{t.notes}</p>
        ) : null}
      </Card>
    </motion.div>
  );
}

export function CustomerTreatmentsView() {
  const [treatments, setTreatments] = useState<TreatmentDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState<PageMeta | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<{ treatments: TreatmentDTO[]; page?: PageMeta }>("/api/treatments")
      .then((res) => {
        if (alive) {
          setTreatments(res.treatments);
          setPage(res.page ?? null);
        }
      })
      .catch((err: Error) => {
        if (alive) toast.error(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo<PetGroup[]>(() => {
    const map = new Map<string, PetGroup>();
    for (const t of treatments ?? []) {
      const g = map.get(t.pet.id);
      if (g) {
        g.items.push(t);
      } else {
        map.set(t.pet.id, { pet: t.pet, items: [t] });
      }
    }
    return Array.from(map.values());
  }, [treatments]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Medical Records"
        description="Treatment history for each of your companions"
      />
      <ListNotice page={page} noun="records" />

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi} className="space-y-3">
              <Skeleton className="h-7 w-44" />
              <div className="space-y-4">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.pet.id} aria-label={`Treatment records for ${g.pet.name}`} className="space-y-3">
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                <span aria-hidden className="text-xl">
                  {petEmoji(g.pet.type)}
                </span>
                {g.pet.name}
                <span className="text-sm font-normal text-muted-foreground">
                  {g.items.length} record{g.items.length === 1 ? "" : "s"}
                </span>
              </h3>
              <div className="max-h-96 space-y-4 overflow-y-auto scrollbar-thin pr-1">
                {g.items.map((t) => (
                  <TreatmentCard key={t.id} t={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Stethoscope />}
          title="No treatment records yet"
          description="Records appear here after completed appointments — your vet or groomer adds them after each visit."
        />
      )}
    </div>
  );
}
