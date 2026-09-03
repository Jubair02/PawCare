"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Pill, Scissors, Stethoscope } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { formatDate, petEmoji } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PageMeta, TreatmentDTO } from "@/lib/types";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function VetTreatmentsView() {
  const user = useAppStore((s) => s.user);
  const [treatments, setTreatments] = useState<TreatmentDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const isVet = user?.role === "VET";

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ treatments: TreatmentDTO[]; page?: PageMeta }>("/api/treatments");
      setTreatments(res.treatments);
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

  return (
    <div className="space-y-4">
      <SectionHeader
        title={isVet ? "Treatments" : "Session records"}
        description={
          isVet
            ? "Medical records you have written, newest first."
            : "Grooming notes you have logged, newest first."
        }
      />
      <ListNotice page={page} noun="records" />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : treatments.length === 0 ? (
        <EmptyState
          icon={isVet ? <Stethoscope /> : <Scissors />}
          title="No records yet"
          description={
            isVet
              ? "Create records from Appointments when completing a visit."
              : "Create records from Appointments when completing a session."
          }
        />
      ) : (
        <div className="space-y-3">
          {treatments.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-4 transition-shadow hover:shadow-md">
                {/* Header: visit date + pet + status */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 flex-col items-center rounded-xl bg-primary/10 px-3 py-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        {formatDate(t.appointment.date)}
                      </span>
                      <span className="text-[11px] text-primary/70">{t.appointment.time}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {petEmoji(t.pet.type)} {t.pet.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.provider.specialty === "GROOMER" ? "Groomer" : "Dr."} {t.provider.name}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={t.appointment.status} />
                </div>

                <div className="mt-3 space-y-2">
                  {t.diagnosis ? (
                    <p className="text-sm font-semibold">{t.diagnosis}</p>
                  ) : null}
                  {t.symptoms ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Symptoms: </span>
                      {t.symptoms}
                    </p>
                  ) : null}
                  {t.treatmentPlan ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Plan: </span>
                      {t.treatmentPlan}
                    </p>
                  ) : null}
                  {t.prescription ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Prescription: </span>
                      {t.prescription}
                    </p>
                  ) : null}

                  {(t.medication || t.dosage || t.followUpDate) ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {t.medication ? (
                        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                          <Pill className="mr-1 size-3" />
                          {t.medication}
                          {t.dosage ? ` · ${t.dosage}` : ""}
                        </Badge>
                      ) : t.dosage ? (
                        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                          {t.dosage}
                        </Badge>
                      ) : null}
                      {t.followUpDate ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
                        >
                          <CalendarDays className="mr-1 size-3" />
                          Follow-up {formatDate(t.followUpDate)}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}

                  {t.notes ? (
                    <p className="pt-1 text-sm italic text-muted-foreground">“{t.notes}”</p>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Subtle hint pinned at the bottom for empty-handed staff scanning the page */}
      {!loading && treatments.length > 0 ? (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="size-3.5" />
          New records are created from Appointments when completing a visit.
        </p>
      ) : null}
    </div>
  );
}
