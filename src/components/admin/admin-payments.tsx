"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Banknote, CalendarClock, HandCoins, Loader2, Receipt, RefreshCw, RotateCcw, TrendingUp } from "lucide-react";
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
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants";
import { formatBDT, formatDate, formatInstantDate } from "@/lib/formatters";
import type { PageMeta, PaymentDTO } from "@/lib/types";

/* ------------------------------- constants -------------------------------- */

/** ISO datetime → "20 Nov 2025" (formatDate expects yyyy-MM-dd). */
const fmtPaidAt = formatInstantDate;

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/* --------------------------------- view ----------------------------------- */

export function AdminPaymentsView() {
  const [payments, setPayments] = useState<PaymentDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const [refundTarget, setRefundTarget] = useState<PaymentDTO | null>(null);
  const [refunding, setRefunding] = useState(false);

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ payments: PaymentDTO[]; page?: PageMeta }>("/api/payments");
      setPayments(res.payments);
      setPage(res.page ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load payments");
      setPayments(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* -------------------------------- stats --------------------------------- */

  const stats = useMemo(() => {
    const all = payments ?? [];
    let revenue = 0;
    let monthRevenue = 0;
    let refunded = 0;
    for (const p of all) {
      if (p.status === "PAID") {
        revenue += p.amount;
        if (isThisMonth(p.paidAt)) monthRevenue += p.amount;
      }
      if (p.status === "REFUNDED") refunded += p.amount;
    }
    return { revenue, monthRevenue, refunded, transactions: all.length };
  }, [payments]);

  const visible = useMemo(
    () =>
      (payments ?? []).filter(
        (p) =>
          (statusFilter === "ALL" || p.status === statusFilter) &&
          (methodFilter === "ALL" || p.method === methodFilter)
      ),
    [payments, statusFilter, methodFilter]
  );

  /* ------------------------------ mutations ------------------------------- */

  const [collectingId, setCollectingId] = useState<string | null>(null);

  // Cash sits as PENDING until someone at the desk confirms it changed hands.
  async function collectCash(p: PaymentDTO) {
    setCollectingId(p.id);
    try {
      await apiFetch(`/api/payments/${p.id}/collect`, { method: "PATCH" });
      toast.success(`Collected ${formatBDT(p.amount)} from ${p.customer.name}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the collection");
    } finally {
      setCollectingId(null);
    }
  }

  const [voidingId, setVoidingId] = useState<string | null>(null);

  // Uncollected cash on a cancelled booking has no other exit: it cannot be
  // collected and the refund route rightly refuses it.
  async function voidCash(p: PaymentDTO) {
    setVoidingId(p.id);
    try {
      await apiFetch(`/api/payments/${p.id}/void`, { method: "PATCH" });
      toast.success(`Invoice ${p.invoiceId} voided`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not void the payment");
    } finally {
      setVoidingId(null);
    }
  }

  async function handleRefund() {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      await apiFetch(`/api/payments/${refundTarget.id}/refund`, { method: "PATCH" });
      toast.success(`Payment ${refundTarget.invoiceId} refunded`);
      setRefundTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refund payment");
    } finally {
      setRefunding(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <SectionHeader title="Payments" description="Every invoice across the clinic — revenue, refunds and transactions.">
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </SectionHeader>
      <ListNotice page={page} noun="payments" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={formatBDT(stats.revenue)} icon={<Banknote />} tone="default" hint="All PAID transactions" />
        <StatCard title="This Month" value={formatBDT(stats.monthRevenue)} icon={<TrendingUp />} tone="teal" hint="PAID this month" />
        <StatCard title="Transactions" value={stats.transactions} icon={<Receipt />} tone="violet" hint="Invoices recorded" />
        <StatCard title="Refunded" value={formatBDT(stats.refunded)} icon={<RotateCcw />} tone="amber" hint="Returned to customers" />
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Cash due</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Method</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="min-h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All methods</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden items-end md:flex">
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {payments?.length ?? 0} payments
          </p>
        </div>
      </div>

      {/* Content */}
      {loading && !payments ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !payments || payments.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No payments yet"
          description="Invoices appear here as soon as customers pay for appointments."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No payments match the filters"
          description="Try a different status or payment method."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-96 overflow-y-auto scrollbar-thin rounded-xl border md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Paid at</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-medium">{p.invoiceId}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(fmtPaidAt(p.paidAt))}</TableCell>
                    <TableCell>
                      <p className="truncate font-medium">{p.customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.customer.email}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden>{p.appointment.service.icon}</span> {p.appointment.service.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{p.appointment.pet.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-semibold">{formatBDT(p.amount)}</TableCell>
                    <TableCell className="text-sm">{paymentMethodLabel(p.method)}</TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                      {p.transactionId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {p.status === "PENDING" ? (
                          <Button
                            size="sm"
                            className="min-h-10 whitespace-nowrap"
                            disabled={collectingId === p.id}
                            onClick={() => void collectCash(p)}
                          >
                            {collectingId === p.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <HandCoins className="size-4" />
                            )}
                            Mark received
                          </Button>
                        ) : null}
                        {p.status === "PENDING" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-10 whitespace-nowrap text-muted-foreground hover:text-foreground"
                            disabled={voidingId === p.id}
                            onClick={() => void voidCash(p)}
                          >
                            {voidingId === p.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Ban className="size-4" />
                            )}
                            Void
                          </Button>
                        ) : p.status === "PAID" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-10 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:bg-amber-950/40 hover:text-amber-700 dark:text-amber-200"
                            onClick={() => setRefundTarget(p)}
                          >
                            <RotateCcw className="size-4" /> Refund
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
              <li key={p.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{p.invoiceId}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.customer.name} · {p.customer.email}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-2 truncate text-sm">
                  <span aria-hidden className="mr-1">{p.appointment.service.icon}</span>
                  {p.appointment.service.name} · {p.appointment.pet.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatBDT(p.amount)}</span>
                  <span>{paymentMethodLabel(p.method)}</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" /> {formatDate(fmtPaidAt(p.paidAt))}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{p.transactionId}</p>
                {p.status === "PENDING" ? (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      size="sm"
                      className="min-h-10"
                      disabled={collectingId === p.id}
                      onClick={() => void collectCash(p)}
                    >
                      {collectingId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <HandCoins className="size-4" />
                      )}
                      Mark received
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10 text-muted-foreground"
                      disabled={voidingId === p.id}
                      onClick={() => void voidCash(p)}
                    >
                      {voidingId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Ban className="size-4" />
                      )}
                      Void
                    </Button>
                  </div>
                ) : null}
                {p.status === "PAID" ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:bg-amber-950/40 hover:text-amber-700 dark:text-amber-200"
                      onClick={() => setRefundTarget(p)}
                    >
                      <RotateCcw className="size-4" /> Refund
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Refund confirm */}
      <AlertDialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {refundTarget
                ? `${refundTarget.invoiceId} — ${formatBDT(refundTarget.amount)} paid by ${refundTarget.customer.name} will be marked as REFUNDED and the related appointment invoice updated. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRefund();
              }}
              disabled={refunding}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {refunding ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Refund {refundTarget ? formatBDT(refundTarget.amount) : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
