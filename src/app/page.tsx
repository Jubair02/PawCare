"use client";

import type { ComponentType } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { LandingView } from "@/components/landing/landing-view";
import { AuthView } from "@/components/auth/auth-view";
import { useAppStore } from "@/lib/store";
import { NotificationsView } from "@/components/shared/notifications-view";
import { ProfileView } from "@/components/shared/profile-view";

import { CustomerDashboard } from "@/components/customer/customer-dashboard";
import { PetsView } from "@/components/customer/pets-view";
import { PetDetailView } from "@/components/customer/pet-detail-view";
import { BookingFlow } from "@/components/customer/booking-flow";
import { CustomerAppointmentsView } from "@/components/customer/appointments-view";
import { CustomerTreatmentsView } from "@/components/customer/treatments-view";
import { CustomerPaymentsView } from "@/components/customer/payments-view";
import { CustomerReviewsView } from "@/components/customer/reviews-view";

import { VetDashboard } from "@/components/vet/vet-dashboard";
import { VetAppointmentsView } from "@/components/vet/vet-appointments";
import { VetPatientsView } from "@/components/vet/vet-patients";
import { VetTreatmentsView } from "@/components/vet/vet-treatments";
import { VetScheduleView } from "@/components/vet/vet-schedule";

import { StaffDashboard } from "@/components/staff/staff-dashboard";
import { StaffAppointmentsView } from "@/components/staff/staff-appointments";
import { StaffCustomersView } from "@/components/staff/staff-customers";
import { StaffPetsView } from "@/components/staff/staff-pets";
import { StaffPaymentsView } from "@/components/staff/staff-payments";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminUsersView } from "@/components/admin/admin-users";
import { AdminPetsView } from "@/components/admin/admin-pets";
import { AdminServicesView } from "@/components/admin/admin-services";
import { AdminAppointmentsView } from "@/components/admin/admin-appointments";
import { AdminPaymentsView } from "@/components/admin/admin-payments";
import { AdminReviewsView } from "@/components/admin/admin-reviews";
import { AdminReportsView } from "@/components/admin/admin-reports";
import { AdminSettingsView } from "@/components/admin/admin-settings";

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

export default function Page() {
  const view = useAppStore((s) => s.view) || "landing";

  const ViewComponent = VIEWS[view] ?? LandingView;

  return (
    <AppShell>
      <ViewComponent />
    </AppShell>
  );
}
