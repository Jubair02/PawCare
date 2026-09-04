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
import { DetailRow } from "@/components/shared/detail-row";
import { apiFetch, errMsg } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { PET_TYPES, genderLabel, petTypeLabel } from "@/lib/constants";
import { formatDate, formatInstantDate, petAge, petEmoji } from "@/lib/formatters";
import type { PageMeta, PetDTO } from "@/lib/types";

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
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => setSelected(p)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(p);
                      }
                    }}
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
                        {petTypeLabel(p.type)}
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
                      {formatDate(formatInstantDate(p.createdAt))}
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
                          {petTypeLabel(p.type)}
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
                      {formatDate(formatInstantDate(p.createdAt))}
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
                  {petTypeLabel(selected.type)}
                  {selected.breed ? ` · ${selected.breed}` : ""}
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
                <DetailRow label="Visits">{selected._count?.appointments ?? 0}</DetailRow>
                <DetailRow label="Registered">
                  {formatDate(formatInstantDate(selected.createdAt))}
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
