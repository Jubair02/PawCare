"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PawPrint, Search } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { PET_TYPES } from "@/lib/constants";
import { formatDate, petEmoji } from "@/lib/formatters";
import type { PageMeta, PetDTO } from "@/lib/types";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function typeLabel(type: string): string {
  return PET_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** "2021-03-14" → "4 yrs 2 mos" (best-effort, blank when missing) */
function ageFromBirthDate(birthDate?: string): string {
  if (!birthDate) return "";
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "Newborn";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} mo${months === 1 ? "" : "s"}`;
  if (rem === 0) return `${years} yr${years === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"} ${rem} mo${rem === 1 ? "" : "s"}`;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

export function StaffPetsView() {
  const [pets, setPets] = useState<PetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<PetDTO | null>(null);

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

  const filtered = useMemo(() => {
    let list = pets;
    if (typeFilter !== "ALL") list = list.filter((p) => p.type === typeFilter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.breed ?? "").toLowerCase().includes(needle) ||
          (p.owner?.name ?? "").toLowerCase().includes(needle)
      );
    }
    return list;
  }, [pets, typeFilter, q]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Pets"
        description="Every registered pet with its owner, vaccination status and visit count."
      >
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by pet type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {PET_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.emoji} {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pet, breed or owner…"
            className="pl-9"
            aria-label="Search pets"
          />
      <ListNotice page={page} noun="pets" />
        </div>
      </SectionHeader>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PawPrint />}
          title={q || typeFilter !== "ALL" ? "No matching pets" : "No pets registered"}
          description={
            q || typeFilter !== "ALL"
              ? "Try clearing the search or type filter."
              : "Pets will appear here as customers add them."
          }
        />
      ) : (
        <>
          {/* Table — md and up */}
          <div className="hidden overflow-x-auto rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Vaccination</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(p)}
                    aria-label={`Open details for ${p.name}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                          {petEmoji(p.type)}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-36 truncate font-medium">{p.name}</span>
                          <span className="block max-w-36 truncate text-xs text-muted-foreground">
                            {p.breed ?? "—"}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/30 text-primary">
                        {typeLabel(p.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="max-w-36 truncate text-muted-foreground">
                        {p.owner?.name ?? "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.vaccinationStatus ?? ""} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {p._count?.appointments ?? 0}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(p.createdAt.slice(0, 10))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards — mobile */}
          <div className="grid gap-3 sm:grid-cols-2 md:hidden">
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
                  aria-label={`Open details for ${p.name}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">
                      {petEmoji(p.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{p.name}</p>
                        <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
                          {typeLabel(p.type)}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{p.breed ?? "—"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Owner · {p.owner?.name ?? "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      {p._count?.appointments ?? 0} visit{(p._count?.appointments ?? 0) === 1 ? "" : "s"} ·{" "}
                      {formatDate(p.createdAt.slice(0, 10))}
                    </span>
                    <StatusBadge status={p.vaccinationStatus ?? ""} />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Pet details dialog */}
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
                  {typeLabel(selected.type)}
                  {selected.breed ? ` · ${selected.breed}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div>
                <DetailRow label="Gender">{selected.gender ?? "—"}</DetailRow>
                <DetailRow label="Age">
                  {ageFromBirthDate(selected.birthDate ?? undefined) || "—"}
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
                <DetailRow label="Visits">{selected._count?.appointments ?? 0}</DetailRow>
                <DetailRow label="Registered">
                  {formatDate(selected.createdAt.slice(0, 10))}
                </DetailRow>
                {selected.medicalNotes ? (
                  <DetailRow label="Medical notes">
                    <span className="block max-w-xs whitespace-pre-wrap text-left text-sm font-normal text-muted-foreground">
                      {selected.medicalNotes}
                    </span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Owner contact">
                  <span>
                    {selected.owner?.name ?? "Unknown"}
                    {selected.owner?.phone ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {selected.owner.phone}
                      </span>
                    ) : null}
                    {selected.owner?.email ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {selected.owner.email}
                      </span>
                    ) : null}
                  </span>
                </DetailRow>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
