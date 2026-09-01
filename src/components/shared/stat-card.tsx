import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "amber" | "rose" | "violet" | "teal";

const TONE_STYLES: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
  violet: "bg-violet-100 text-violet-600",
  teal: "bg-teal-100 text-teal-600",
};

export function StatCard({
  title,
  value,
  icon,
  hint,
  tone = "default",
  className,
}: {
  title: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm leading-snug text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5", TONE_STYLES[tone])}>
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
