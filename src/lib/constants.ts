import {
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  LayoutDashboard,
  PawPrint,
  Receipt,
  Scissors,
  Settings,
  Stethoscope,
  Star,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  PAYMENT_METHOD_VALUES,
  PET_TYPE_VALUES,
  SERVICE_CATEGORY_VALUES,
  STATUS_FLOW as DOMAIN_STATUS_FLOW,
  VACCINATION_STATUS_VALUES,
} from "./domain";
import type { AppointmentStatus, PaymentMethod, Role, ServiceCategory, VaccinationStatus } from "./types";

export { allowedTransitions } from "./domain";

/** Mirrors DEFAULT_PAGE_SIZE / MAX_PAGE_SIZE in the API paging helper. */
export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 500;

export interface NavItem {
  view: string;
  label: string;
  icon: LucideIcon;
}

/** Sidebar/mobile nav per role (CONTRACT view registry). cust-pet-detail is reached programmatically. */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  CUSTOMER: [
    { view: "cust-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { view: "cust-pets", label: "My Pets", icon: PawPrint },
    { view: "cust-book", label: "Book Appointment", icon: CalendarPlus },
    { view: "cust-appointments", label: "Appointments", icon: CalendarDays },
    { view: "cust-treatments", label: "Medical Records", icon: Stethoscope },
    { view: "cust-payments", label: "Payments", icon: Receipt },
    { view: "cust-reviews", label: "Reviews", icon: Star },
    { view: "cust-notifications", label: "Notifications", icon: Bell },
    { view: "cust-profile", label: "Profile", icon: User },
  ],
  VET: [
    { view: "vet-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { view: "vet-appointments", label: "Appointments", icon: CalendarDays },
    { view: "vet-patients", label: "Patients", icon: PawPrint },
    { view: "vet-treatments", label: "Treatments", icon: Stethoscope },
    { view: "vet-schedule", label: "Schedule", icon: CalendarClock },
    { view: "vet-profile", label: "Profile", icon: User },
  ],
  GROOMER: [
    { view: "vet-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { view: "vet-appointments", label: "Appointments", icon: CalendarDays },
    { view: "vet-patients", label: "Patients", icon: PawPrint },
    { view: "vet-treatments", label: "Treatments", icon: Scissors },
    { view: "vet-schedule", label: "Schedule", icon: CalendarClock },
    { view: "vet-profile", label: "Profile", icon: User },
  ],
  STAFF: [
    { view: "staff-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { view: "staff-appointments", label: "Appointments", icon: CalendarDays },
    { view: "staff-customers", label: "Customers", icon: Users },
    { view: "staff-pets", label: "Pets", icon: PawPrint },
    { view: "staff-payments", label: "Payments", icon: Receipt },
    { view: "staff-profile", label: "Profile", icon: User },
  ],
  ADMIN: [
    { view: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { view: "admin-users", label: "Users", icon: Users },
    { view: "admin-pets", label: "Pets", icon: PawPrint },
    { view: "admin-services", label: "Services", icon: Scissors },
    { view: "admin-appointments", label: "Appointments", icon: CalendarDays },
    { view: "admin-payments", label: "Payments", icon: Receipt },
    { view: "admin-reviews", label: "Reviews", icon: Star },
    { view: "admin-reports", label: "Reports", icon: BarChart3 },
    { view: "admin-settings", label: "Settings", icon: Settings },
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  VET: "Veterinarian",
  GROOMER: "Groomer",
  CUSTOMER: "Customer",
};

export interface DemoAccount {
  role: Role;
  name: string;
  email: string;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "CUSTOMER", name: "Rahim Uddin", email: "customer@pawcare.com", password: "customer123" },
  { role: "VET", name: "Dr. Nusrat Jahan", email: "vet@pawcare.com", password: "vet123" },
  { role: "GROOMER", name: "Sadia Karim", email: "groomer@pawcare.com", password: "groomer123" },
  { role: "STAFF", name: "Farhan Ahmed", email: "staff@pawcare.com", password: "staff123" },
  { role: "ADMIN", name: "Ayesha Rahman", email: "admin@pawcare.com", password: "admin123" },
];

/** Happy-path status flow (CANCELLED possible from PENDING/CONFIRMED/CHECKED_IN). */
export const STATUS_FLOW = [...DOMAIN_STATUS_FLOW] as AppointmentStatus[];

export interface Option<T extends string = string> {
  value: T;
  label: string;
  emoji?: string;
}

/**
 * The option lists below carry UI copy only. Their *values* come from
 * `src/lib/domain.ts`, which the API validates against, so a value can no
 * longer exist in one half of the app and not the other.
 */
const PET_TYPE_UI: Record<string, { label: string; emoji: string }> = {
  DOG: { label: "Dog", emoji: "🐶" },
  CAT: { label: "Cat", emoji: "🐱" },
  BIRD: { label: "Bird", emoji: "🐦" },
  OTHER: { label: "Other", emoji: "🐾" },
};
export const PET_TYPES: Option[] = PET_TYPE_VALUES.map((value) => ({
  value,
  ...PET_TYPE_UI[value],
}));

const SERVICE_CATEGORY_UI: Record<string, string> = {
  MEDICAL: "Medical",
  GROOMING: "Grooming",
  DIAGNOSTIC: "Diagnostic",
};
export const SERVICE_CATEGORIES: Option<ServiceCategory>[] = SERVICE_CATEGORY_VALUES.map(
  (value) => ({ value: value as ServiceCategory, label: SERVICE_CATEGORY_UI[value] })
);

const VACCINATION_STATUS_UI: Record<string, string> = {
  UP_TO_DATE: "Up to date",
  PARTIAL: "Partial",
  NONE: "None",
};
export const VACCINATION_STATUSES: Option<VaccinationStatus>[] = VACCINATION_STATUS_VALUES.map(
  (value) => ({ value: value as VaccinationStatus, label: VACCINATION_STATUS_UI[value] })
);

const PAYMENT_METHOD_UI: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE: "Mobile Banking",
};
export const PAYMENT_METHODS: Option<PaymentMethod>[] = PAYMENT_METHOD_VALUES.map((value) => ({
  value: value as PaymentMethod,
  label: PAYMENT_METHOD_UI[value],
}));

/** Landing page anchors (also used by the public footer quick links). */
export const LANDING_ANCHORS = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "How it works" },
  { href: "#team", label: "Our team" },
  { href: "#reviews", label: "Reviews" },
];
