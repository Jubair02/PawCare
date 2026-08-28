import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status → badge color map (CONTRACT design system).
 * Unknown statuses fall back to muted.
 */
const STATUS_STYLES: Record<string, string> = {
  // Appointment statuses
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CHECKED_IN: "bg-teal-100 text-teal-800 border-teal-200",
  IN_PROGRESS: "bg-violet-100 text-violet-800 border-violet-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
  // Payment statuses
  UNPAID: "bg-amber-100 text-amber-800 border-amber-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REFUNDED: "bg-stone-100 text-stone-700 border-stone-200",
  // Review statuses
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  HIDDEN: "bg-stone-100 text-stone-700 border-stone-200",
  // Vaccination statuses (handy for pet cards)
  UP_TO_DATE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIAL: "bg-amber-100 text-amber-800 border-amber-200",
  NONE: "bg-stone-100 text-stone-700 border-stone-200",
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
