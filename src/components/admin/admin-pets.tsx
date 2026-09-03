"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Eye, PawPrint, RefreshCw, Search, Syringe } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { formatDate, formatInstantDate, initials, petEmoji } from "@/lib/formatters";
import type { PageMeta, PetDTO } from "@/lib/types";

/* ------------------------------- constants -------------------------------- */

const TYPE_BADGE: Record<string, string> = {
  DOG: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  CAT: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  BIRD: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-900",
  OTHER: "bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900",
};

const TYPE_TABS = ["ALL", "DOG", "CAT", "BIRD", "OTHER"];

/** ISO datetime → "20 Nov 2025" (formatDate expects yyyy-MM-dd). */
const fmtJoined = formatInstantDate;

/** "yyyy-MM-dd" → "2y 6mo" style age label. */
function calcAge(birthDate?: string): string {
  if (!birthDate) return "—";
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "—";
  if (months === 0) return "Newborn";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months}mo`;
  return rem ? `${years}y ${rem}mo` : `${years}y`;
}

/* --------------------------------- view ----------------------------------- */

export function AdminPetsView() {
  const [pets, setPets] = useState<PetDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<PetDTO | null>(null);

  // Debounce search → server q
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const qs = params.toString();
      const res = await apiFetch<{ pets: PetDTO[]; page?: PageMeta }>(`/api/pets${qs ? `?${qs}` : ""}`);
      setPets(res.pets);
      setPage(res.page ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pets");
      setPets(null);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = (pets ?? []).filter((p) => typeFilter === "ALL" || p.type === typeFilter);

  return (
    <div className="space-y-6">
      <SectionHeader title="Pets" description="All registered patients with owners, vaccination status and visit history.">
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </SectionHeader>
      <ListNotice page={page} noun="pets" />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              className="min-h-9"
              onClick={() => setTypeFilter(t)}
            >
              {t === "ALL" ? "All" : `${petEmoji(t)} ${t.charAt(0)}${t.slice(1).toLowerCase()}`}
            </Button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pet, breed or owner…"
            className="pl-9"
            aria-label="Search pets"
          />
        </div>
      </div>

      {/* Content */}
      {loading && !pets ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !pets || visible.length === 0 ? (
        <EmptyState
          icon={<PawPrint />}
          title="No pets found"
          description={
            q || typeFilter !== "ALL"
              ? "No pets match the current search or type filter."
              : "Pets registered by customers will appear here."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-96 overflow-y-auto scrollbar-thin rounded-xl border md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Pet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Vaccination</TableHead>
                  <TableHead className="text-center">Visits</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(p)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg" aria-hidden>
                          {petEmoji(p.type)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.breed || "Mixed"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_BADGE[p.type] ?? ""}>
                        {p.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="truncate font-medium">{p.owner?.name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.owner?.email ?? ""}</p>
                    </TableCell>
                    <TableCell className="text-sm">{p.gender ? p.gender.charAt(0) + p.gender.slice(1).toLowerCase() : "—"}</TableCell>
                    <TableCell className="text-sm">{calcAge(p.birthDate)}</TableCell>
                    <TableCell className="text-sm">{p.weight != null ? `${p.weight} kg` : "—"}</TableCell>
                    <TableCell>{p.vaccinationStatus ? <StatusBadge status={p.vaccinationStatus} /> : "—"}</TableCell>
                    <TableCell className="text-center text-sm">{p._count?.appointments ?? 0}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtJoined(p.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(p);
                          }}
                          aria-label={`View ${p.name}`}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((p) => (
              <li
                key={p.id}
                className="cursor-pointer rounded-xl border p-4"
                role="button"
                tabIndex={0}
                onClick={() => setDetail(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetail(p);
                  }
                }}
                aria-label={`View details for ${p.name}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl" aria-hidden>
                    {petEmoji(p.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.breed || "Mixed"}</p>
                      </div>
                      <Badge variant="outline" className={TYPE_BADGE[p.type] ?? ""}>
                        {p.type}
                      </Badge>
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      Owner: {p.owner?.name ?? "—"} · {p.owner?.email ?? ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{p.gender ? p.gender.charAt(0) + p.gender.slice(1).toLowerCase() : "—"}</span>
                      <span>{calcAge(p.birthDate)}</span>
                      <span>{p.weight != null ? `${p.weight} kg` : ""}</span>
                      <span>{p._count?.appointments ?? 0} visits</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {p.vaccinationStatus ? <StatusBadge status={p.vaccinationStatus} /> : <span />}
                      <span className="text-xs text-muted-foreground">Reg. {fmtJoined(p.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-xl" aria-hidden>
                    {petEmoji(detail.type)}
                  </span>
                  <span>
                    {detail.name}
                    <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                      {detail.breed || "Mixed"}
                    </span>
                  </span>
                </DialogTitle>
                <DialogDescription>Full patient profile and owner contact.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge variant="outline" className={`mt-1 ${TYPE_BADGE[detail.type] ?? ""}`}>
                      {detail.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gender</p>
                    <p className="mt-1 font-medium">{detail.gender ? detail.gender.charAt(0) + detail.gender.slice(1).toLowerCase() : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Age</p>
                    <p className="mt-1 font-medium">
                      {calcAge(detail.birthDate)}
                      {detail.birthDate ? <span className="ml-1 text-xs font-normal text-muted-foreground">({formatDate(detail.birthDate)})</span> : null}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Weight</p>
                    <p className="mt-1 font-medium">{detail.weight != null ? `${detail.weight} kg` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Color</p>
                    <p className="mt-1 font-medium">{detail.color || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vaccination</p>
                    <div className="mt-1">{detail.vaccinationStatus ? <StatusBadge status={detail.vaccinationStatus} /> : "—"}</div>
                  </div>
                </div>

                {/* Medical notes */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    <Syringe className="size-3.5" /> Medical notes
                  </p>
                  <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                    {detail.medicalNotes || "No medical notes recorded."}
                  </p>
                </div>

                {/* Owner contact */}
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Owner contact</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(detail.owner?.name ?? "?")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{detail.owner?.name ?? "Unknown owner"}</p>
                      <p className="truncate text-xs text-muted-foreground">{detail.owner?.email ?? ""}</p>
                      {detail.owner?.phone ? (
                        <p className="text-xs text-muted-foreground">{detail.owner.phone}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck className="size-3.5" /> {detail._count?.appointments ?? 0} visits
                  </span>
                  <span>Registered {formatDate(fmtJoined(detail.createdAt))}</span>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
