"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";

import { AppShell } from "@/components/shell/app-shell";
import { LandingView } from "@/components/landing/landing-view";
import { AuthView } from "@/components/auth/auth-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import { useViewUrlSync } from "@/hooks/use-view-url-sync";

/**
 * Placeholder shown for the moment a view's chunk is in flight.
 *
 * Deliberately generic and layout-stable: it occupies the same region the real
 * view will, so switching views does not collapse the page and shift the
 * chrome around it.
 */
function ViewLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Every private view is code-split.
 *
 * The registry used to import all forty views statically, so a visitor who only
 * ever saw the marketing page still downloaded every admin table, the booking
 * flow and the charting library with it — one ~1MB chunk covering the whole
 * product. Splitting them means each role pulls only the screens it opens.
 *
 * `ssr: false` matches what already happened at runtime: AppShell gates private
 * views behind a hydration flag, so none of these ever rendered on the server.
 * Landing, auth and the shell stay statically imported because they are the
 * first paint and must not wait on a second request.
 */
const lazyView = <T extends ComponentType<object>>(load: () => Promise<T>) =>
  dynamic(load, { loading: () => <ViewLoading />, ssr: false });

// Shared across several role prefixes — declared once so they share one chunk.
const NotificationsView = lazyView(() =>
  import("@/components/shared/notifications-view").then((m) => m.NotificationsView)
);
const ProfileView = lazyView(() =>
  import("@/components/shared/profile-view").then((m) => m.ProfileView)
);

// Customer
const CustomerDashboard = lazyView(() =>
  import("@/components/customer/customer-dashboard").then((m) => m.CustomerDashboard)
);
const PetsView = lazyView(() => import("@/components/customer/pets-view").then((m) => m.PetsView));
const PetDetailView = lazyView(() =>
  import("@/components/customer/pet-detail-view").then((m) => m.PetDetailView)
);
const BookingFlow = lazyView(() =>
  import("@/components/customer/booking-flow").then((m) => m.BookingFlow)
);
const CustomerAppointmentsView = lazyView(() =>
  import("@/components/customer/appointments-view").then((m) => m.CustomerAppointmentsView)
);
const CustomerTreatmentsView = lazyView(() =>
  import("@/components/customer/treatments-view").then((m) => m.CustomerTreatmentsView)
);
const CustomerPaymentsView = lazyView(() =>
  import("@/components/customer/payments-view").then((m) => m.CustomerPaymentsView)
);
const CustomerReviewsView = lazyView(() =>
  import("@/components/customer/reviews-view").then((m) => m.CustomerReviewsView)
);

// Vet / Groomer
const VetDashboard = lazyView(() => import("@/components/vet/vet-dashboard").then((m) => m.VetDashboard));
const VetAppointmentsView = lazyView(() =>
  import("@/components/vet/vet-appointments").then((m) => m.VetAppointmentsView)
);
const VetPatientsView = lazyView(() =>
  import("@/components/vet/vet-patients").then((m) => m.VetPatientsView)
);
const VetTreatmentsView = lazyView(() =>
  import("@/components/vet/vet-treatments").then((m) => m.VetTreatmentsView)
);
const VetScheduleView = lazyView(() =>
  import("@/components/vet/vet-schedule").then((m) => m.VetScheduleView)
);

// Staff
const StaffDashboard = lazyView(() =>
  import("@/components/staff/staff-dashboard").then((m) => m.StaffDashboard)
);
const StaffAppointmentsView = lazyView(() =>
  import("@/components/staff/staff-appointments").then((m) => m.StaffAppointmentsView)
);
const StaffCustomersView = lazyView(() =>
  import("@/components/staff/staff-customers").then((m) => m.StaffCustomersView)
);
const StaffPetsView = lazyView(() => import("@/components/staff/staff-pets").then((m) => m.StaffPetsView));
const StaffPaymentsView = lazyView(() =>
  import("@/components/staff/staff-payments").then((m) => m.StaffPaymentsView)
);

// Admin
const AdminDashboard = lazyView(() =>
  import("@/components/admin/admin-dashboard").then((m) => m.AdminDashboard)
);
const AdminUsersView = lazyView(() => import("@/components/admin/admin-users").then((m) => m.AdminUsersView));
const AdminPetsView = lazyView(() => import("@/components/admin/admin-pets").then((m) => m.AdminPetsView));
const AdminServicesView = lazyView(() =>
  import("@/components/admin/admin-services").then((m) => m.AdminServicesView)
);
const AdminAppointmentsView = lazyView(() =>
  import("@/components/admin/admin-appointments").then((m) => m.AdminAppointmentsView)
);
const AdminPaymentsView = lazyView(() =>
  import("@/components/admin/admin-payments").then((m) => m.AdminPaymentsView)
);
const AdminReviewsView = lazyView(() =>
  import("@/components/admin/admin-reviews").then((m) => m.AdminReviewsView)
);
const AdminReportsView = lazyView(() =>
  import("@/components/admin/admin-reports").then((m) => m.AdminReportsView)
);
const AdminSettingsView = lazyView(() =>
  import("@/components/admin/admin-settings").then((m) => m.AdminSettingsView)
);

/**
 * SPA view registry — the whole app renders on `/`.
 * Navigation happens through the zustand store (setView); the AppShell
 * provides role-guarded chrome (sidebar/topbar/footer) around each view.
 */
const VIEWS: Record<string, ComponentType> = {
  // Public
  landing: LandingView,
  auth: AuthView,

  // Customer
  "cust-dashboard": CustomerDashboard,
  "cust-pets": PetsView,
  "cust-pet-detail": PetDetailView,
  "cust-book": BookingFlow,
  "cust-appointments": CustomerAppointmentsView,
  "cust-treatments": CustomerTreatmentsView,
  "cust-payments": CustomerPaymentsView,
  "cust-reviews": CustomerReviewsView,
  "cust-notifications": NotificationsView,
  "cust-profile": ProfileView,

  // Vet / Groomer
  "vet-dashboard": VetDashboard,
  "vet-appointments": VetAppointmentsView,
  "vet-patients": VetPatientsView,
  "vet-treatments": VetTreatmentsView,
  "vet-schedule": VetScheduleView,
  "vet-profile": ProfileView,

  // Staff
  "staff-dashboard": StaffDashboard,
  "staff-appointments": StaffAppointmentsView,
  "staff-customers": StaffCustomersView,
  "staff-pets": StaffPetsView,
  "staff-payments": StaffPaymentsView,
  "staff-profile": ProfileView,

  // Admin
  "admin-dashboard": AdminDashboard,
  "admin-users": AdminUsersView,
  "admin-pets": AdminPetsView,
  "admin-services": AdminServicesView,
  "admin-appointments": AdminAppointmentsView,
  "admin-payments": AdminPaymentsView,
  "admin-reviews": AdminReviewsView,
  "admin-reports": AdminReportsView,
  "admin-settings": AdminSettingsView,
};

/** Only keys in the registry above are accepted from the address bar. */
function isValidView(view: string): boolean {
  return Object.prototype.hasOwnProperty.call(VIEWS, view);
}

export default function Page() {
  const view = useAppStore((s) => s.view) || "landing";

  // Keeps `?view=` and the store in step, so views are linkable and Back works.
  useViewUrlSync(isValidView);

  const ViewComponent = VIEWS[view] ?? LandingView;

  return (
    <AppShell>
      <ViewComponent />
    </AppShell>
  );
}
