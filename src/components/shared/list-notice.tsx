"use client";

import { Layers } from "lucide-react";

import type { PageMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * List endpoints are capped so a single request can never pull an unbounded
 * table. When a list is longer than the cap this says so, rather than silently
 * showing a subset — which matters here because several views derive their tab
 * counts from whatever the client happens to be holding.
 *
 * Renders nothing when the whole list is loaded, which is the normal case.
 */
export function ListNotice({
  page,
  noun = "records",
  className,
}: {
  page: PageMeta | null | undefined;
  noun?: string;
  className?: string;
}) {
  if (!page?.hasMore) return null;

  const shown = Math.min(page.offset + page.limit, page.total);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200",
        className
      )}
      role="status"
    >
      <Layers className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
      <p>
        Showing the most recent {shown} of {page.total} {noun}. Use the filters or search to
        narrow this list.
      </p>
    </div>
  );
}
