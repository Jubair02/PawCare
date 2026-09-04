"use client";

/**
 * Chart scaffolding shared by the admin dashboard and the reports view.
 *
 * Both pages had a character-identical copy of every piece below, so a tooltip
 * or card tweak had to be made twice. Note what is deliberately *not* here: the
 * recharts `<linearGradient id>` for the revenue area stays at each call site
 * (`revGradDash`, `revGradReport`) because two gradients rendered on one page
 * must not share an id.
 */

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { formatBDT } from "@/lib/formatters";

/** Exact status colors per CONTRACT (no blue/indigo anywhere). */
export const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--status-pending)",
  CONFIRMED: "var(--status-confirmed)",
  CHECKED_IN: "var(--status-checked-in)",
  IN_PROGRESS: "var(--status-in-progress)",
  COMPLETED: "var(--status-completed)",
  CANCELLED: "var(--status-cancelled)",
};

export interface TipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
}

/** White card tooltip: border + shadow + rounded (design system). */
export function ChartTip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  money?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-32 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      {label !== undefined && label !== "" ? (
        <p className="mb-1 font-semibold text-foreground">{label}</p>
      ) : null}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color ?? "var(--chart-1)" }} />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto pl-3 font-semibold text-stone-800 dark:text-stone-200">
            {money ? formatBDT(Number(entry.value) || 0) : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Axis money label: 1200 → "৳1.2k" (keeps the Y axis narrow). */
export const compactMoney = (v: number) =>
  Math.abs(v) >= 1000 ? `৳${Number((v / 1000).toFixed(1))}k` : `৳${v}`;

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-4 sm:p-6">
      <div className="mb-4">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}
