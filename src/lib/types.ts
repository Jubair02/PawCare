// PawCare — shared DTO types (per CONTRACT)
// Backend must return these shapes; all UI agents import from here.

export type Role = "ADMIN" | "STAFF" | "VET" | "GROOMER" | "CUSTOMER";
export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
/** An appointment's payment state. CASH_DUE = cash promised, not yet collected. */
export type PaymentStatus = "UNPAID" | "CASH_DUE" | "PAID" | "REFUNDED";
/** A payment record's own state. PENDING = awaiting collection at the desk. */
export type PaymentRecordStatus = "PENDING" | "PAID" | "REFUNDED";
export type PaymentMethod = "CASH" | "CARD" | "MOBILE";
export type ProviderSpecialty = "VET" | "GROOMER";
export type ServiceCategory = "MEDICAL" | "GROOMING" | "DIAGNOSTIC";
export type PetType = "DOG" | "CAT" | "BIRD" | "OTHER";
export type VaccinationStatus = "UP_TO_DATE" | "PARTIAL" | "NONE";
export type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";
export type NotificationType = "BOOKING" | "STATUS" | "PAYMENT" | "TREATMENT" | "SYSTEM";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  specialty?: string;
  bio?: string;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  specialty?: string;
  bio?: string;
  active: boolean;
  createdAt: string;
  _count?: {
    pets?: number;
    customerAppointments?: number;
  };
}

export interface PetDTO {
  id: string;
  name: string;
  type: PetType | string;
  breed?: string;
  gender?: string;
  birthDate?: string;
  weight?: number;
  color?: string;
  photo?: string;
  medicalNotes?: string;
  vaccinationStatus?: string;
  ownerId: string;
  createdAt: string;
  owner?: { id: string; name: string; email: string; phone?: string };
  _count?: { appointments?: number };
}

export interface ServiceDTO {
  id: string;
  name: string;
  category: ServiceCategory | string;
  description: string;
  duration: number;
  price: number;
  icon: string;
  active: boolean;
  createdAt: string;
  _count?: { appointments?: number };
  rating?: number | null;
  reviewCount?: number;
}

export interface ProviderDTO {
  id: string;
  name: string;
  email: string;
  specialty: ProviderSpecialty | string;
  bio?: string;
  phone?: string;
  active: boolean;
  rating?: number | null;
  reviewCount?: number;
}

export interface AppointmentDTO {
  id: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  status: AppointmentStatus | string;
  paymentStatus: PaymentStatus | string;
  price: number;
  notes?: string;
  createdAt: string;
  customer: { id: string; name: string; email: string; phone?: string };
  pet: { id: string; name: string; type: PetType | string; breed?: string; photo?: string };
  service: { id: string; name: string; category: string; icon: string; duration: number; price: number };
  provider: { id: string; name: string; specialty?: string };
  treatment?: { id: string } | null;
  review?: { id: string; rating: number } | null;
}

export interface TreatmentDTO {
  id: string;
  symptoms?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  prescription?: string;
  medication?: string;
  dosage?: string;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  appointment: { id: string; date: string; time: string; status: string };
  pet: { id: string; name: string; type: PetType | string };
  provider: { id: string; name: string; specialty?: string };
}

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod | string;
  transactionId: string;
  status: PaymentStatus | string;
  paidAt: string;
  customer: { id: string; name: string; email: string };
  appointment: {
    id: string;
    date: string;
    time: string;
    service: { name: string; icon: string };
    pet: { name: string };
  };
}

export interface ReviewDTO {
  id: string;
  rating: number;
  comment?: string;
  status: ReviewStatus | string;
  createdAt: string;
  customer: { id: string; name: string };
  pet?: { id: string; name: string } | null;
  service: { id: string; name: string; icon: string };
  provider: { id: string; name: string; specialty?: string };
  appointment: { id: string; date: string };
}

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  read: boolean;
  createdAt: string;
}

export interface SettingDTO {
  id: string;
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
}

// ---- Auth responses ----
export interface AuthResponse {
  user: SessionUser;
  token: string;
}
export interface ForgotResponse {
  ok: boolean;
  message: string;
}
export interface ProfileResponse {
  user: SessionUser;
}

// ---- Dashboard data ----
export interface CustomerDashboardData {
  totalPets: number;
  upcomingAppointments: number;
  completedServices: number;
  pendingPayments: number;
  pendingAmount: number;
  unreadNotifications: number;
  recentAppointments: AppointmentDTO[]; // 5
  nextAppointment: AppointmentDTO | null;
}

export interface ProviderDashboardData {
  todayAppointments: number;
  pendingAppointments: number;
  completedToday: number;
  totalPatients: number;
  todaySchedule: AppointmentDTO[];
}

export interface StaffDashboardData {
  todayAppointments: number;
  pendingAppointments: number;
  checkedInToday: number;
  revenueToday: number;
  totalCustomers: number;
  totalPets: number;
  todaySchedule: AppointmentDTO[];
}

export interface AdminOverviewData {
  totalCustomers: number;
  totalPets: number;
  todayAppointments: number;
  totalRevenue: number;
  pendingAppointments: number;
  activeProviders: number;
  appointmentsByMonth: { month: string; count: number }[]; // last 6 months chronological
  revenueByMonth: { month: string; amount: number }[]; // last 6 months chronological
  popularServices: { name: string; count: number }[]; // top 5
  statusDistribution: { status: string; count: number }[]; // only non-zero
  recentAppointments: AppointmentDTO[]; // 6
}

// ---- Misc API payloads ----
/** Per-status totals computed server-side over the whole filtered set. */
export type ListCounts = Record<string, number>;

/** Money totals for a payments query, aggregated in the database. */
export interface PaymentSummary {
  paid: number;
  pending: number;
  refunded: number;
  paidCount: number;
  pendingCount: number;
  refundedCount: number;
}

/** Paging metadata returned by every list endpoint (see readPage/pageMeta). */
export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface NotificationsResponse {
  notifications: NotificationDTO[];
  unread: number;
  page?: PageMeta;
}
export interface SlotsResponse {
  slots: string[];
}
export interface OkResponse {
  ok: boolean;
}
export interface PetDetailDTO extends PetDTO {
  appointments: AppointmentDTO[];
  treatments: TreatmentDTO[];
}
