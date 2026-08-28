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
import type { AppointmentStatus, PaymentMethod, Role, ServiceCategory, VaccinationStatus } from "./types";

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
export const STATUS_FLOW: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
];

export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export interface Option<T extends string = string> {
  value: T;
  label: string;
  emoji?: string;
}

export const PET_TYPES: Option[] = [
  { value: "DOG", label: "Dog", emoji: "🐶" },
  { value: "CAT", label: "Cat", emoji: "🐱" },
  { value: "BIRD", label: "Bird", emoji: "🐦" },
  { value: "OTHER", label: "Other", emoji: "🐾" },
];

export const SERVICE_CATEGORIES: Option<ServiceCategory>[] = [
  { value: "MEDICAL", label: "Medical" },
  { value: "GROOMING", label: "Grooming" },
  { value: "DIAGNOSTIC", label: "Diagnostic" },
];

export const VACCINATION_STATUSES: Option<VaccinationStatus>[] = [
  { value: "UP_TO_DATE", label: "Up to date" },
  { value: "PARTIAL", label: "Partial" },
  { value: "NONE", label: "None" },
];

export const PAYMENT_METHODS: Option<PaymentMethod>[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "MOBILE", label: "Mobile Banking" },
];

/** Landing page anchors (also used by the public footer quick links). */
export const LANDING_ANCHORS = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "How it works" },
  { href: "#team", label: "Our team" },
  { href: "#reviews", label: "Reviews" },
];
