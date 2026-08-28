"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { ReviewDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            "size-4",
            n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

export function CustomerReviewsView() {
  const setView = useAppStore((s) => s.setView);
  const [reviews, setReviews] = useState<ReviewDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiFetch<{ reviews: ReviewDTO[] }>("/api/reviews?mine=true")
      .then((res) => {
        if (alive) setReviews(res.reviews);
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

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Reviews"
        description="Feedback you've shared about your visits"
      >
        <Button onClick={() => setView("cust-appointments")} className="min-h-11">
          <CalendarPlus /> Review a completed visit
        </Button>
      </SectionHeader>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : reviews && reviews.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <Card className="h-full flex-col gap-0 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                      <span aria-hidden>{r.service.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.service.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.provider.name} · {formatDate(r.appointment.date)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="mt-3">
                  <StarRow rating={r.rating} />
                </div>

                {r.comment ? (
                  <p className="mt-2 text-sm text-muted-foreground">“{r.comment}”</p>
                ) : null}

                <p className="mt-auto pt-3 text-xs text-muted-foreground">
                  Written {timeAgo(r.createdAt)}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Star />}
          title="You haven't written any reviews yet"
          description="After a completed visit, share your experience to help other pet parents choose with confidence."
          action={
            <Button onClick={() => setView("cust-appointments")} className="min-h-11">
              <CalendarPlus /> Review a completed visit
            </Button>
          }
        />
      )}
    </div>
  );
}
