"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const PORTFOLIO_URL = "https://jhossain.vercel.app/";

/**
 * Compact site-wide footer bar: copyright on the left, author credit on the
 * right, with an optional `note` slot (phone, tagline…) in between.
 *
 * `tone="dark"` matches the landing page's emerald footer; the default light
 * tone uses theme tokens so it fits every in-app surface.
 */
export function SiteFooter({
  tone = "light",
  note,
  className,
  as: Tag = "footer",
}: {
  tone?: "light" | "dark";
  note?: ReactNode;
  className?: string;
  /** Use "div" when the bar sits inside an existing <footer> (landing page). */
  as?: "footer" | "div";
}) {
  const year = new Date().getFullYear();
  const dark = tone === "dark";

  return (
    <Tag
      className={cn(
        "w-full border-t",
        dark
          ? "border-emerald-800/60 text-emerald-200/70"
          : "border-border bg-muted/40 text-muted-foreground",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-xs sm:flex-row sm:gap-4 sm:text-left md:px-6">
        <p>© {year} PawCare Pet Clinic. All rights reserved.</p>

        {note ? <div className="order-last sm:order-none">{note}</div> : null}

        <p>
          Built by{" "}
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-medium underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm",
              dark ? "text-emerald-100 hover:text-white" : "text-foreground hover:text-primary"
            )}
          >
            Jubair Hossain
          </a>
        </p>
      </div>
    </Tag>
  );
}
