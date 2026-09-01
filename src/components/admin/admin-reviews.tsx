"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, EyeOff, Loader2, MessageSquareText, RefreshCw, Star, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/formatters";
import type { ReviewDTO } from "@/lib/types";

/* ------------------------------- constants -------------------------------- */

const REVIEW_TABS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "HIDDEN", label: "Hidden" },
];

/* --------------------------------- view ----------------------------------- */

export function AdminReviewsView() {
  const [reviews, setReviews] = useState<ReviewDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");

  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ reviews: ReviewDTO[] }>("/api/reviews?status=ALL");
      setReviews(res.reviews);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load reviews");
      setReviews(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const all = reviews ?? [];
    return {
      ALL: all.length,
      PENDING: all.filter((r) => r.status === "PENDING").length,
      APPROVED: all.filter((r) => r.status === "APPROVED").length,
      HIDDEN: all.filter((r) => r.status === "HIDDEN").length,
    };
  }, [reviews]);

  const visible = useMemo(
    () => (reviews ?? []).filter((r) => tab === "ALL" || r.status === tab),
    [reviews, tab]
  );

  /* ------------------------------ mutations ------------------------------- */

  async function handleStatus(r: ReviewDTO, status: string) {
    setMutatingId(r.id);
    try {
      await apiFetch(`/api/reviews/${r.id}`, { method: "PATCH", body: { status } });
      toast.success(`Review ${status.toLowerCase()}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update review");
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/reviews/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Review deleted");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete review");
    } finally {
      setDeleting(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <SectionHeader title="Reviews" description="Moderate customer feedback — approve, hide or remove reviews.">
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </SectionHeader>

      {/* Filter tabs with counts */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          {REVIEW_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="min-h-9">
              {t.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 text-xs font-semibold ${
                  t.value === "PENDING" && counts.PENDING > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts[t.value as keyof typeof counts]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {loading && !reviews ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : !reviews || reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText />}
          title="No reviews yet"
          description="Customer reviews will appear here after completed appointments are rated."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText />}
          title={`No ${tab === "ALL" ? "" : tab.toLowerCase() + " "}reviews`}
          description="There is nothing in this moderation queue right now."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ReviewCard
                r={r}
                busy={mutatingId === r.id}
                onApprove={() => void handleStatus(r, "APPROVED")}
                onHide={() => void handleStatus(r, "HIDDEN")}
                onDelete={() => setDeleteTarget(r)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.rating}★ by ${deleteTarget.customer.name} for “${deleteTarget.service.name}” will be permanently removed. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------ subcomponent ------------------------------- */

function ReviewCard({
  r,
  busy,
  onApprove,
  onHide,
  onDelete,
}: {
  r: ReviewDTO;
  busy: boolean;
  onApprove: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const canApprove = r.status === "PENDING" || r.status === "HIDDEN";
  const canHide = r.status === "APPROVED" || r.status === "PENDING";

  return (
    <Card className="flex h-full flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex" aria-label={`Rated ${r.rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`size-4 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-stone-300"}`}
              aria-hidden
            />
          ))}
        </span>
        <StatusBadge status={r.status} />
      </div>

      <p className="min-h-10 flex-1 text-sm leading-relaxed">
        {r.comment ? `“${r.comment}”` : <span className="text-muted-foreground">No comment provided.</span>}
      </p>

      <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-xs">
        <p>
          <span className="text-muted-foreground">Service:</span>{" "}
          <span aria-hidden className="mr-0.5">{r.service.icon}</span>
          <span className="font-medium">{r.service.name}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Provider:</span>{" "}
          <span className="font-medium">{r.provider.name}</span>
          {r.provider.specialty ? <span className="text-muted-foreground"> ({r.provider.specialty})</span> : null}
        </p>
        <p>
          <span className="text-muted-foreground">Customer:</span>{" "}
          <span className="font-medium">{r.customer.name}</span>
          {r.pet ? <span className="text-muted-foreground"> · {r.pet.name}</span> : null}
        </p>
        <p className="text-muted-foreground">
          Appointment {r.appointment.date} · {timeAgo(r.createdAt)}
        </p>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {canApprove ? (
          <Button variant="outline" size="sm" className="min-h-9" disabled={busy} onClick={onApprove}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
          </Button>
        ) : null}
        {canHide ? (
          <Button variant="outline" size="sm" className="min-h-9" disabled={busy} onClick={onHide}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />} Hide
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          disabled={busy}
          onClick={onDelete}
          aria-label="Delete review"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
