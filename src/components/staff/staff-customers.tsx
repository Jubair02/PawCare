"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
import { apiFetch, errMsg, isAbortError } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { formatDateShort, formatTime, initials, petEmoji, timeAgo } from "@/lib/formatters";
import type { AppointmentDTO, PageMeta, PetDTO, UserDTO } from "@/lib/types";

export function StaffCustomersView() {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<UserDTO | null>(null);
  const [pets, setPets] = useState<PetDTO[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debounce search input (300ms per contract)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams({ role: "CUSTOMER" });
        if (debouncedQ) params.set("q", debouncedQ);
        const res = await apiFetch<{ users: UserDTO[]; page?: PageMeta }>(
          `/api/users?${params.toString()}`,
          { signal }
        );
        setUsers(res.users);
        setPage(res.page ?? null);
      } catch (e) {
        if (isAbortError(e)) return;
        toast.error(errMsg(e));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [debouncedQ]
  );

  // Aborting on cleanup keeps a slow result for an earlier search term from
  // landing after the newer one and replacing the list the user is reading.
  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Detail data for the selected customer (pets + their appointments)
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setPets([]);
    setAppointments([]);
    setDetailLoading(true);
    Promise.all([
      apiFetch<{ pets: PetDTO[] }>(`/api/pets?ownerId=${selected.id}`),
      apiFetch<{ appointments: AppointmentDTO[] }>("/api/appointments"),
    ])
      .then(([petsRes, apptsRes]) => {
        if (cancelled) return;
        setPets(petsRes.pets);
        setAppointments(
          apptsRes.appointments.filter((a) => a.customer.id === selected.id).slice(0, 5)
        );
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const cards = useMemo(() => users, [users]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Customers"
        description="Everyone registered with the clinic — open a card for pets and visit history."
      >
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="pl-9"
            aria-label="Search customers"
          />
      <ListNotice page={page} noun="customers" />
        </div>
      </SectionHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q ? "No matching customers" : "No customers yet"}
          description={
            q
              ? "Try a different name or email."
              : "Customer accounts will appear here as people register."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((u) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                role="button"
                tabIndex={0}
                className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setSelected(u)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(u);
                  }
                }}
                aria-label={`Open details for ${u.name}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-sm font-bold text-white">
                    {initials(u.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                    {u.phone ? (
                      <p className="truncate text-sm text-muted-foreground">{u.phone}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    {u._count?.pets ?? 0} pet{(u._count?.pets ?? 0) === 1 ? "" : "s"}
                  </span>
                  <span>Joined {timeAgo(u.createdAt)}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Customer detail: pets + recent appointments */}
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials(selected.name)}
                  </span>
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  {selected.email}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </DialogDescription>
              </DialogHeader>

              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading customer…
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pets */}
                  <section>
                    <p className="mb-2 text-sm font-semibold">Pets ({pets.length})</p>
                    {pets.length === 0 ? (
                      <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                        This customer has no registered pets.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {pets.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 rounded-xl border p-2.5"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                              {petEmoji(p.type)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{p.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {p.breed ?? "—"}
                              </span>
                            </span>
                            <StatusBadge status={p.vaccinationStatus ?? ""} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Recent appointments */}
                  <section>
                    <p className="mb-2 text-sm font-semibold">Recent appointments</p>
                    {appointments.length === 0 ? (
                      <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                        No appointments on record yet.
                      </p>
                    ) : (
                      <div className="max-h-96 divide-y overflow-y-auto rounded-xl border scrollbar-thin">
                        {appointments.map((a) => (
                          <div
                            key={a.id}
                            className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2.5"
                          >
                            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                              {formatDateShort(a.date)} · {formatTime(a.time)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {a.service.icon} {a.service.name}
                              <span className="text-muted-foreground"> · {a.pet.name}</span>
                            </span>
                            <StatusBadge status={a.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
