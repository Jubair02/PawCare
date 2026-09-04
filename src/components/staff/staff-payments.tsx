"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, HandCoins, Info, Loader2, Receipt, ReceiptText, RefreshCcwDot } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Card } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { apiFetch, errMsg } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants";
import { clinicToday, formatBDT, formatDate, formatInstantDate, formatInstantTime, timeAgo } from "@/lib/formatters";
import type { PageMeta, PaymentDTO } from "@/lib/types";

// Payment records are PENDING (cash awaiting collection), PAID or REFUNDED.
// "UNPAID" was never a payment-record status, so that filter matched nothing.
const STATUS_OPTIONS = ["PENDING", "PAID", "REFUNDED"];

export function StaffPaymentsView() {
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");

  const [page, setPage] = useState<PageMeta | null>(null);

  const [collectingId, setCollectingId] = useState<string | null>(null);
  // Collecting cash is one-way for staff — only an admin can refund — so the
  // button opens this confirmation instead of posting straight away.
  const [collectTarget, setCollectTarget] = useState<PaymentDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ payments: PaymentDTO[]; page?: PageMeta }>("/api/payments");
      setPayments(res.payments);
      setPage(res.page ?? null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // The only path that turns a cash intent into revenue.
  async function collectCash(p: PaymentDTO) {
    setCollectingId(p.id);
    try {
      await apiFetch<{ payment: PaymentDTO }>(`/api/payments/${p.id}/collect`, { method: "PATCH" });
      toast.success(`Collected ${formatBDT(p.amount)} from ${p.customer.name}`);
      setCollectTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the collection");
    } finally {
      setCollectingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const today = clinicToday();
    let collected = 0;
    let todayTotal = 0;
    let refunded = 0;
    for (const p of payments) {
      if (p.status === "PAID") {
        collected += p.amount;
        if (formatInstantDate(p.paidAt) === today) todayTotal += p.amount;
      } else if (p.status === "REFUNDED") {
        refunded += p.amount;
      }
    }
    return { collected, todayTotal, refunded, count: payments.length };
  }, [payments]);

  const filtered = useMemo(() => {
    let list = payments;
    if (statusFilter !== "ALL") list = list.filter((p) => p.status === statusFilter);
    if (methodFilter !== "ALL") list = list.filter((p) => p.method === methodFilter);
    return list;
  }, [payments, statusFilter, methodFilter]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Payments"
        description="Every invoice at the clinic — collections, refunds and transaction references."
      />
      <ListNotice page={page} noun="payments" />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Total Collected"
              value={formatBDT(stats.collected)}
              icon={<CircleCheck />}
              hint="Sum of paid invoices"
              tone="teal"
            />
            <StatCard
              title="Collected Today"
              value={formatBDT(stats.todayTotal)}
              icon={<Receipt />}
              hint="Paid earlier today"
            />
            <StatCard
              title="Transactions"
              value={stats.count}
              icon={<ReceiptText />}
              hint="All payment records"
              tone="violet"
            />
            <StatCard
              title="Refunded"
              value={formatBDT(stats.refunded)}
              icon={<RefreshCcwDot />}
              hint="Returned to customers"
              tone="amber"
            />
          </>
        )}
      </section>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Record payments from the Appointments page — open an appointment and use its payment
          action.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by payment status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by payment method">
            <SelectValue placeholder="Method" />
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
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {payments.length} shown
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={payments.length === 0 ? "No payments yet" : "No matching payments"}
          description={
            payments.length === 0
              ? "Payments recorded from the Appointments page will appear here."
              : "Try clearing the status or method filter."
          }
        />
      ) : (
        <>
          {/* Table — md and up */}
          <div className="hidden overflow-x-auto rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-semibold">{p.invoiceId}</TableCell>
                    <TableCell>
                      <span className="block whitespace-nowrap text-sm">
                        {formatDate(formatInstantDate(p.paidAt))}
                      </span>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatInstantTime(p.paidAt)} · {timeAgo(p.paidAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-36 truncate font-medium">{p.customer.name}</span>
                      <span className="block max-w-36 truncate text-xs text-muted-foreground">
                        {p.customer.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-40 truncate">
                        {p.appointment.service.icon} {p.appointment.service.name}
                      </span>
                    </TableCell>
                    <TableCell>{p.appointment.pet.name}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBDT(p.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {paymentMethodLabel(p.method)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {p.transactionId}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "PENDING" ? (
                        <Button
                          size="sm"
                          className="min-h-9 whitespace-nowrap"
                          disabled={collectingId === p.id}
                          onClick={() => setCollectTarget(p)}
                        >
                          {collectingId === p.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <HandCoins className="size-4" />
                          )}
                          Mark received
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards — mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-muted-foreground">
                        {p.invoiceId}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold">
                        {p.appointment.service.icon} {p.appointment.service.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.customer.name} · {p.appointment.pet.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatBDT(p.amount)}</p>
                      <StatusBadge status={p.status} className="mt-1" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <span>
                      {paymentMethodLabel(p.method)} · {formatDate(formatInstantDate(p.paidAt))}{" "}
                      {formatInstantTime(p.paidAt)}
                    </span>
                    <span className="font-mono text-[11px]">{p.transactionId}</span>
                  </div>
                  {p.status === "PENDING" ? (
                    <Button
                      className="mt-3 min-h-11 w-full"
                      disabled={collectingId === p.id}
                      onClick={() => setCollectTarget(p)}
                    >
                      {collectingId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <HandCoins className="size-4" />
                      )}
                      Mark received
                    </Button>
                  ) : null}
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Collect confirm — staff cannot reverse this; refunds are admin-only */}
      <AlertDialog open={!!collectTarget} onOpenChange={(o) => !o && setCollectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record this payment as received?</AlertDialogTitle>
            <AlertDialogDescription>
              {collectTarget
                ? `${collectTarget.invoiceId} — confirm you have taken ${formatBDT(collectTarget.amount)} in ${paymentMethodLabel(collectTarget.method).toLowerCase()} from ${collectTarget.customer.name}. The invoice becomes PAID immediately, and only an admin can refund it.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!collectingId}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (collectTarget) void collectCash(collectTarget);
              }}
              disabled={!!collectingId}
            >
              {collectingId ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />}
              Confirm {collectTarget ? formatBDT(collectTarget.amount) : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
