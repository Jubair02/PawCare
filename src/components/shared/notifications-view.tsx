"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarPlus,
  CheckCheck,
  Loader2,
  RefreshCw,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/formatters";
import type { NotificationDTO, NotificationsResponse } from "@/lib/types";
import { SectionHeader } from "./section-header";

const TYPE_ICONS: Record<string, { icon: LucideIcon; cls: string }> = {
  BOOKING: { icon: CalendarPlus, cls: "bg-teal-100 text-teal-600" },
  STATUS: { icon: RefreshCw, cls: "bg-violet-100 text-violet-600" },
  PAYMENT: { icon: Wallet, cls: "bg-emerald-100 text-emerald-600" },
  TREATMENT: { icon: Stethoscope, cls: "bg-rose-100 text-rose-600" },
  SYSTEM: { icon: Bell, cls: "bg-amber-100 text-amber-600" },
};

function TypeIcon({ type }: { type: string }) {
  const meta = TYPE_ICONS[type?.toUpperCase?.() ?? ""] ?? TYPE_ICONS.SYSTEM;
  const Icon = meta.icon;
  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.cls)}>
      <Icon className="size-4" />
    </div>
  );
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<NotificationsResponse>("/api/notifications");
      setNotifications(res.notifications);
      setUnread(res.unread);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/notifications/read", { method: "POST", body: { all: true } });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark notifications read");
    } finally {
      setMarkingAll(false);
    }
  }

  async function markOneRead(n: NotificationDTO) {
    if (n.read) return;
    setMarkingId(n.id);
    try {
      await apiFetch<{ ok: boolean }>("/api/notifications/read", {
        method: "POST",
        body: { ids: [n.id] },
      });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // silent — reading should not nag the user with errors
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You're all caught up"}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={markAllRead}
          disabled={markingAll || unread === 0 || loading}
        >
          {markingAll ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
          Mark all read
        </Button>
      </SectionHeader>

      <Card className="gap-0 p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl p-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-6" />
            </div>
            <p className="font-semibold">No notifications yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Booking updates, payments and treatment records will appear here.
            </p>
          </div>
        ) : (
          <ul className="max-h-96 list-none space-y-1 overflow-y-auto scrollbar-thin">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void markOneRead(n)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60",
                    !n.read && "bg-accent/60",
                    markingId === n.id && "opacity-60"
                  )}
                >
                  <TypeIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>
                        {n.title}
                      </p>
                      {!n.read ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Compact list used inside the shell's bell popover (vet/staff/admin). */
export function NotificationsMiniList({
  notifications,
  onMarkOne,
  onMarkAll,
  markingAll,
}: {
  notifications: NotificationDTO[];
  onMarkOne: (n: NotificationDTO) => void;
  onMarkAll: () => void;
  markingAll?: boolean;
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <Bell className="mb-2 size-6 text-muted-foreground" />
        <p className="text-sm font-medium">No notifications</p>
        <p className="text-xs text-muted-foreground">You're all caught up.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <ul className="max-h-80 list-none space-y-1 overflow-y-auto scrollbar-thin">
        {notifications.slice(0, 6).map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onMarkOne(n)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60",
                !n.read && "bg-accent/60"
              )}
            >
              <TypeIcon type={n.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={cn("truncate text-xs", n.read ? "font-medium" : "font-semibold")}>{n.title}</p>
                  {!n.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
                <p className="text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {notifications.some((n) => !n.read) ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onMarkAll}
          disabled={markingAll}
        >
          {markingAll ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
          Mark all read
        </Button>
      ) : null}
    </div>
  );
}
