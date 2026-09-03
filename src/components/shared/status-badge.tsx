import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status → badge color map (CONTRACT design system).
 * Unknown statuses fall back to muted.
 */
const STATUS_STYLES: Record<string, string> = {
  // Appointment statuses
  PENDING: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  CONFIRMED: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  CHECKED_IN: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-900",
  IN_PROGRESS: "bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-900",
  COMPLETED: "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900",
  CANCELLED: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900",
  // Payment statuses
  UNPAID: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  CASH_DUE: "bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-900",
  PAID: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  REFUNDED: "bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900",
  // Review statuses
  APPROVED: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  HIDDEN: "bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900",
  // Vaccination statuses (handy for pet cards)
  UP_TO_DATE: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  PARTIAL: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  NONE: "bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (!status) return null;
  const cls = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn(cls, "uppercase tracking-wide", className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
