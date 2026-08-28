"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { STATUS_FLOW, STATUS_TRANSITIONS } from "@/lib/constants";
import { formatBDT, formatDateShort, formatTime, petEmoji } from "@/lib/formatters";
import type { AppointmentDTO } from "@/lib/types";

/* ------------------------------- constants -------------------------------- */

const TRANSITION_LABELS: Record<string, string> = {
  CONFIRMED: "Confirm",
  CHECKED_IN: "Check in",
  IN_PROGRESS: "Start service",
  COMPLETED: "Mark completed",
  CANCELLED: "Cancel appointment",
};

/* --------------------------------- view ----------------------------------- */

export function AdminAppointmentsView() {
  const [appts, setAppts] = useState<AppointmentDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState<AppointmentDTO | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (dateFilter) params.set("date", dateFilter);
      const qs = params.toString();
      const res = await apiFetch<{ appointments: AppointmentDTO[] }>(
        `/api/appointments${qs ? `?${qs}` : ""}`
      );
      setAppts(res.appointments);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load appointments");
      setAppts(null);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Client-side search across customer / pet / service / provider
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appts ?? [];
    return (appts ?? []).filter((a) =>
      [a.customer.name, a.customer.email, a.pet.name, a.service.name, a.provider.name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [appts, search]);

  // Summary chips from the loaded (server-filtered) result set
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of appts ?? []) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    return STATUS_FLOW.filter((s) => counts.get(s)).map((s) => ({ status: s, count: counts.get(s) ?? 0 }));
  }, [appts]);

  /* ------------------------------ mutations ------------------------------- */

  async function handleStatus(a: AppointmentDTO, next: string) {
    setMutatingId(a.id);
    try {
      await apiFetch(`/api/appointments/${a.id}/status`, { method: "PATCH", body: { status: next } });
      toast.success(`Appointment ${TRANSITION_LABELS[next]?.toLowerCase() ?? next.toLowerCase()}`);
      void load();
      setDetails((d) => (d && d.id === a.id ? { ...d, status: next } : d));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update appointment");
    } finally {
      setMutatingId(null);
    }
  }

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <SectionHeader title="Appointments" description="Clinic-wide bookings — advance the status flow or cancel as needed.">
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </SectionHeader>

      {/* Summary chips */}
      {appts && appts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {appts.length} total
          </span>
          {summary.map((s) => (
            <span key={s.status} className="inline-flex items-center gap-1.5">
              <StatusBadge status={s.status} />
              <span className="text-xs font-medium text-muted-foreground">{s.count}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v)}
          >
            <SelectTrigger className="min-h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_FLOW.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="appt-date" className="text-xs text-muted-foreground">Date (optional)</Label>
          <Input
            id="appt-date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="appt-search" className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="appt-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, pet, service, provider…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && !appts ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !appts || visible.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No appointments found"
          description="Try clearing the status or date filters, or a different search term."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-96 overflow-y-auto scrollbar-thin rounded-xl border md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Date &amp; time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    a={a}
                    mutatingId={mutatingId}
                    onStatus={handleStatus}
                    onDetails={() => setDetails(a)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((a) => (
              <AppointmentCard
                key={a.id}
                a={a}
                mutatingId={mutatingId}
                onStatus={handleStatus}
                onDetails={() => setDetails(a)}
              />
            ))}
          </ul>
        </>
      )}

      {/* Details dialog */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
          {details ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  Appointment · {formatDateShort(details.date)} {formatTime(details.time)}
                  <StatusBadge status={details.status} />
                  <StatusBadge status={details.paymentStatus} />
                </DialogTitle>
                <DialogDescription>Booking reference {details.id.slice(0, 8).toUpperCase()}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="mt-0.5 font-medium">{details.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{details.customer.email}</p>
                    {details.customer.phone ? (
                      <p className="text-xs text-muted-foreground">{details.customer.phone}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pet</p>
                    <p className="mt-0.5 font-medium">
                      <span aria-hidden className="mr-1">{petEmoji(details.pet.type)}</span>
                      {details.pet.name}
                    </p>
                    {details.pet.breed ? <p className="text-xs text-muted-foreground">{details.pet.breed}</p> : null}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Service</p>
                    <p className="mt-0.5 font-medium">
                      <span aria-hidden className="mr-1">{details.service.icon}</span>
                      {details.service.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {details.service.category} · {details.service.duration} min
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Provider</p>
                    <p className="mt-0.5 font-medium">{details.provider.name}</p>
                    {details.provider.specialty ? (
                      <p className="text-xs text-muted-foreground">{details.provider.specialty}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="mt-0.5 font-semibold">{formatBDT(details.price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Extras</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {details.treatment ? "Treatment recorded" : "No treatment record"}
                      {" · "}
                      {details.review ? `Reviewed (${details.review.rating}★)` : "No review"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm">{details.notes || "No notes provided."}</p>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ subcomponents ------------------------------ */

interface RowProps {
  a: AppointmentDTO;
  mutatingId: string | null;
  onStatus: (a: AppointmentDTO, next: string) => void;
  onDetails: () => void;
}

function ActionsMenu({ a, mutatingId, onStatus, onDetails }: RowProps) {
  const transitions = STATUS_TRANSITIONS[a.status as keyof typeof STATUS_TRANSITIONS] ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          disabled={mutatingId === a.id}
          aria-label={`Actions for appointment of ${a.pet.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onDetails}>
          <Eye className="size-4" /> View details
        </DropdownMenuItem>
        {transitions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Set status</DropdownMenuLabel>
            {transitions.map((next) => (
              <DropdownMenuItem
                key={next}
                onClick={() => onStatus(a, next)}
                className={next === "CANCELLED" ? "text-rose-600 focus:text-rose-700" : ""}
              >
                {next === "CANCELLED" ? "✕" : "→"} {TRANSITION_LABELS[next] ?? next}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppointmentRow({ a, mutatingId, onStatus, onDetails }: RowProps) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <p className="font-medium">{formatDateShort(a.date)}</p>
        <p className="text-xs text-muted-foreground">{formatTime(a.time)}</p>
      </TableCell>
      <TableCell>
        <p className="truncate font-medium">{a.customer.name}</p>
        <p className="truncate text-xs text-muted-foreground">{a.customer.email}</p>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>{petEmoji(a.pet.type)}</span> {a.pet.name}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>{a.service.icon}</span> {a.service.name}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">{a.provider.name}</TableCell>
      <TableCell className="whitespace-nowrap text-sm font-semibold">{formatBDT(a.price)}</TableCell>
      <TableCell>
        <StatusBadge status={a.status} />
      </TableCell>
      <TableCell>
        <StatusBadge status={a.paymentStatus} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <ActionsMenu a={a} mutatingId={mutatingId} onStatus={onStatus} onDetails={onDetails} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function AppointmentCard({ a, mutatingId, onStatus, onDetails }: RowProps) {
  return (
    <li className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            <span aria-hidden className="mr-1">{a.service.icon}</span>
            {a.service.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {a.customer.name} · {petEmoji(a.pet.type)} {a.pet.name} · {a.provider.name}
          </p>
        </div>
        <ActionsMenu a={a} mutatingId={mutatingId} onStatus={onStatus} onDetails={onDetails} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-muted-foreground">
          {formatDateShort(a.date)} · {formatTime(a.time)}
        </span>
        <span className="text-xs font-semibold">{formatBDT(a.price)}</span>
        <StatusBadge status={a.status} />
        <StatusBadge status={a.paymentStatus} />
      </div>
    </li>
  );
}
