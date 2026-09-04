"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
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
import { paymentMethodLabel } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { formatBDT, formatDate, formatInstantDate } from "@/lib/formatters";
import type { PageMeta, PaymentDTO } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

type StatusFilter = "ALL" | "PAID" | "REFUNDED";

/** paidAt is an ISO instant — show the clinic-local day, not the UTC one. */
function paidDate(iso: string): string {
  return formatDate(formatInstantDate(iso ?? ""));
}

export function CustomerPaymentsView() {
  const [payments, setPayments] = useState<PaymentDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const [page, setPage] = useState<PageMeta | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<{ payments: PaymentDTO[]; page?: PageMeta }>("/api/payments")
      .then((res) => {
        if (alive) {
          setPayments(res.payments);
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

  const summary = useMemo(() => {
    const list = payments ?? [];
    const totalPaid = list
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);
    const last = list.reduce<string | null>(
      (acc, p) => (!acc || p.paidAt > acc ? p.paidAt : acc),
      null
    );
    return { totalPaid, count: list.length, last };
  }, [payments]);

  const filtered = useMemo(() => {
    const list = payments ?? [];
    return filter === "ALL" ? list : list.filter((p) => p.status === filter);
  }, [payments, filter]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Payments"
        description="Invoices and receipts for your visits"
      >
        <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <SelectTrigger className="min-h-11 w-36" aria-label="Filter by payment status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </SectionHeader>
      <ListNotice page={page} noun="payments" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total paid"
          value={formatBDT(summary.totalPaid)}
          icon={<Receipt />}
          hint="Sum of paid invoices"
        />
        <StatCard
          title="Invoices"
          value={summary.count}
          icon={<FileText />}
          tone="teal"
          hint="All your invoices"
        />
        <StatCard
          title="Last payment"
          value={summary.last ? paidDate(summary.last) : "—"}
          icon={<CalendarDays />}
          tone="amber"
          hint="Most recent transaction"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* Table on md+ */}
          <div className="hidden overflow-hidden rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.invoiceId}</TableCell>
                    <TableCell className="whitespace-nowrap">{paidDate(p.paidAt)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="text-base">
                          {p.appointment.service.icon}
                        </span>
                        <span className="font-medium">{p.appointment.service.name}</span>
                      </span>
                    </TableCell>
                    <TableCell>{p.appointment.pet.name}</TableCell>
                    <TableCell className="whitespace-nowrap font-semibold text-primary">
                      {formatBDT(p.amount)}
                    </TableCell>
                    <TableCell>{paymentMethodLabel(p.method)}</TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                      {p.transactionId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Stacked cards on mobile */}
          <div className="grid gap-4 md:hidden">
            {filtered.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="gap-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                        <span aria-hidden>{p.appointment.service.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.appointment.service.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.appointment.pet.name} · {paymentMethodLabel(p.method)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Invoice</p>
                      <p className="font-mono">{p.invoiceId}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Paid at</p>
                      <p className="font-medium">{paidDate(p.paidAt)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="text-sm font-semibold text-primary">{formatBDT(p.amount)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Transaction</p>
                      <p className="truncate font-mono text-xs">{p.transactionId}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Receipt />}
          title="No payments found"
          description={
            filter === "REFUNDED"
              ? "Refunded invoices will appear here if a payment is ever refunded."
              : "Your invoices will appear here after you pay for an appointment."
          }
        />
      )}
    </div>
  );
}
