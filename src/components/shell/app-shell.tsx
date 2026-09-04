"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Bell,
  LogOut,
  Menu,
  PawPrint,
  Phone,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";
import { initials } from "@/lib/formatters";
import { homeViewForRole, rolePrefixFor, useAppStore } from "@/lib/store";
import type { NotificationDTO, NotificationsResponse, Role, SettingDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NotificationsMiniList } from "@/components/shared/notifications-view";
import { ProfileView } from "@/components/shared/profile-view";
import { SiteFooter } from "@/components/shared/site-footer";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-900",
  STAFF: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-900",
  VET: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  GROOMER: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  CUSTOMER: "bg-primary/10 text-primary border-primary/20",
};

/** Views that render without a session. Everything else requires a login. */
function isPublicView(view: string): boolean {
  return view === "landing" || view === "auth";
}

function SessionSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-lg">
        <PawPrint className="size-8" />
      </div>
      <p className="mt-4 text-lg font-bold tracking-tight">PawCare</p>
      <p className="text-xs text-muted-foreground">Loading your session…</p>
    </div>
  );
}

const VIEW_TITLE_OVERRIDES: Record<string, string> = {
  "cust-pet-detail": "Pet Details",
};

function viewTitle(view: string, role: Role): string {
  if (VIEW_TITLE_OVERRIDES[view]) return VIEW_TITLE_OVERRIDES[view];
  const item = (NAV_ITEMS[role] ?? []).find((n) => n.view === view);
  if (item) return item.label;
  const words = view.split("-").slice(1).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Lightweight notification polling for the shell (badge + bell popover). */
function useShellNotifications(active: boolean, refreshKey: string) {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const revision = useAppStore((s) => s.notificationsRevision);
  const notificationsChanged = useAppStore((s) => s.notificationsChanged);

  const load = useCallback(async () => {
    if (!active) return;
    try {
      const res = await apiFetch<NotificationsResponse>("/api/notifications");
      setNotifications(res.notifications);
      setUnread(res.unread);
    } catch {
      // silent — shell badge should not nag on transient failures
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
    // `revision` pulls the badge back in step after the Notifications page (or
    // this popover) marks something read, instead of waiting out the 30s poll.
  }, [active, load, refreshKey, revision]);

  const markOne = useCallback(async (n: NotificationDTO) => {
    if (n.read) return;
    try {
      await apiFetch<{ ok: boolean }>("/api/notifications/read", {
        method: "POST",
        body: { ids: [n.id] },
      });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsChanged();
    } catch {
      // silent
    }
  }, [notificationsChanged]);

  const markAll = useCallback(async () => {
    setMarkingAll(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/notifications/read", {
        method: "POST",
        body: { all: true },
      });
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
      notificationsChanged();
    } catch {
      // silent
    } finally {
      setMarkingAll(false);
    }
  }, [notificationsChanged]);

  return { notifications, unread, markOne, markAll, markingAll };
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
        <PawPrint className="size-5" />
      </div>
      {!compact ? (
        <div className="leading-tight">
          <p className="font-bold tracking-tight">PawCare</p>
          <p className="text-[11px] text-muted-foreground">Pet Care Platform</p>
        </div>
      ) : null}
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
  className,
}: {
  item: NavItem;
  active: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

const emptySubscribe = () => () => {};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [clinicPhone, setClinicPhone] = useState("");

  const user = useAppStore((s) => s.user);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const logout = useAppStore((s) => s.logout);

  // Hydration flag: false on the server & first (hydration) render, true afterwards.
  // Gates rendering until the persisted zustand store has rehydrated on the client.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Clinic phone for the footer (public endpoint, fail-safe)
  useEffect(() => {
    apiFetch<{ setting: SettingDTO }>("/api/settings")
      .then((res) => setClinicPhone(res.setting?.phone ?? ""))
      .catch(() => undefined);
  }, []);

  // Auth + role guard.
  // Logged out on a private view (a stale persisted `view`, or a hand-crafted
  // deep link) used to fall straight through to `children`, rendering an admin
  // screen with no chrome and 401ing fetches. Send those to the login screen.
  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      if (!isPublicView(view)) setView("auth");
      return;
    }
    if (isPublicView(view)) return;
    if (!view.startsWith(rolePrefixFor(user.role))) {
      setView(homeViewForRole(user.role));
    }
  }, [mounted, user, view, setView]);

  const { notifications, unread, markOne, markAll, markingAll } = useShellNotifications(
    !!user && mounted,
    view
  );

  // Branded splash until the persisted store hydrates
  if (!mounted) return <SessionSplash />;

  // Logged out on a private view: the effect above is redirecting to `auth`.
  // Show the splash rather than `children` so the private view never paints.
  if (!user && !isPublicView(view)) {
    return <SessionSplash />;
  }

  // Public surface: landing / auth render themselves (also when logged out)
  if (!user || isPublicView(view)) {
    return <>{children}</>;
  }

  const role = user.role;
  const items = NAV_ITEMS[role] ?? [];
  const prefix = rolePrefixFor(role);
  const isCustomer = role === "CUSTOMER";
  const isAdmin = role === "ADMIN";

  const go = (v: string) => setView(v);

  const isActive = (item: NavItem) =>
    view === item.view || (item.view === "cust-pets" && view === "cust-pet-detail");

  const handleLogout = () => {
    // Kill the session server-side first; clearing local state alone would
    // leave a working token behind.
    void apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    logout();
    toast.success("Logged out — see you soon!");
  };

  const profileTarget = isAdmin ? null : `${prefix}profile`;

  const bellButton = (
    <Button
      variant="outline"
      size="icon"
      className="relative h-10 w-10"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      onClick={isCustomer ? () => go("cust-notifications") : undefined}
    >
      <Bell className="size-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Button>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="p-4">
          <button
            type="button"
            onClick={() => go(homeViewForRole(role))}
            className="rounded-lg text-left"
            aria-label="Go to dashboard"
          >
            <BrandMark />
          </button>
        </div>
        <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
          {items.map((item) => (
            <NavButton key={item.view} item={item} active={isActive(item)} onSelect={() => go(item.view)} />
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar className="h-9 w-9 border">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <Badge variant="outline" className={cn("mt-0.5 px-1.5 py-0 text-[10px]", ROLE_BADGE[role])}>
                {role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-rose-600 dark:text-rose-300"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4 md:px-6">
            {/* Mobile nav */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 md:hidden" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b p-4">
                  <SheetTitle>
                    <BrandMark />
                  </SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile navigation" className="space-y-1 overflow-y-auto p-3 scrollbar-thin">
                  {items.map((item) => (
                    <NavButton
                      key={item.view}
                      item={item}
                      active={isActive(item)}
                      onSelect={() => {
                        go(item.view);
                        setMobileNavOpen(false);
                      }}
                    />
                  ))}
                  <div className="my-2 border-t" />
                  {isAdmin ? (
                    <NavButton
                      item={{ view: "admin-profile-dialog", label: "Profile", icon: UserIcon }}
                      active={false}
                      onSelect={() => {
                        setProfileOpen(true);
                        setMobileNavOpen(false);
                      }}
                    />
                  ) : null}
                  <NavButton
                    item={{ view: "logout", label: "Log out", icon: LogOut }}
                    active={false}
                    onSelect={handleLogout}
                    className="text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
                  />
                </nav>
              </SheetContent>
            </Sheet>

            <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight md:text-lg">
              {viewTitle(view, role)}
            </h1>

            <ThemeToggle />

            {/* Bell */}
            {isCustomer ? (
              bellButton
            ) : (
              <Popover>
                <PopoverTrigger asChild>{bellButton}</PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-sm font-semibold">Notifications</p>
                    {unread > 0 ? (
                      <Badge variant="outline" className="border-rose-200 dark:border-rose-900 bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200">
                        {unread} unread
                      </Badge>
                    ) : null}
                  </div>
                  <div className="p-2">
                    <NotificationsMiniList
                      notifications={notifications}
                      onMarkOne={(n) => void markOne(n)}
                      onMarkAll={() => void markAll()}
                      markingAll={markingAll}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-2 rounded-full border bg-card p-1 pr-2 transition-colors hover:bg-muted md:min-h-0"
                  aria-label="Open user menu"
                >
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:block">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9 border">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <Badge variant="outline" className={cn("mt-0.5 px-1.5 py-0 text-[10px]", ROLE_BADGE[role])}>
                        {role}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    if (profileTarget) go(profileTarget);
                    else setProfileOpen(true);
                  }}
                >
                  <UserIcon className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} className="text-rose-600 dark:text-rose-300 focus:text-rose-700 dark:text-rose-200">
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>

        {/* Sticky footer */}
        <SiteFooter
          className="mt-auto"
          note={
            clinicPhone ? (
              <p className="flex items-center gap-1.5">
                <Phone className="size-3" />
                {clinicPhone}
              </p>
            ) : null
          }
        />
      </div>

      {/* Admin profile dialog (no admin-profile view in the registry) */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto scrollbar-thin sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your profile</DialogTitle>
            <DialogDescription>Manage your account details and password.</DialogDescription>
          </DialogHeader>
          <ProfileView />
        </DialogContent>
      </Dialog>
    </div>
  );
}
