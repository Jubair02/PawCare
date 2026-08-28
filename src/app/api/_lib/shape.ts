/**
 * Shared backend helpers for PawCare API routes.
 * Lives in a private (`_`-prefixed) folder inside `src/app/api/**` so Next.js
 * never treats it as a route segment.
 */
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import type { Pet, Prisma, Service, User } from "@prisma/client";

/* ---------------------------------- consts --------------------------------- */

export const ROLES = ["ADMIN", "STAFF", "VET", "GROOMER", "CUSTOMER"];
export const PET_TYPES = ["DOG", "CAT", "BIRD", "OTHER"];
export const PET_GENDERS = ["MALE", "FEMALE"];
export const VACCINATION_STATUSES = ["UP_TO_DATE", "PARTIAL", "NONE"];
export const SERVICE_CATEGORIES = ["MEDICAL", "GROOMING", "DIAGNOSTIC"];
export const PAYMENT_METHODS = ["CASH", "CARD", "MOBILE"];
export const REVIEW_STATUSES = ["PENDING", "APPROVED", "HIDDEN"];
export const ALL_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"];

/** Server-enforced appointment status transition rules. */
export const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const EMAIL_RE = /^\S+@\S+\.\S+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------ body & params ------------------------------ */

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

export function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

export function asNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function asBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Last 6 months (including current) as `{ key: "2025-06", label: "Jun" }`, chronological. */
export function last6Months(): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTHS_SHORT[d.getMonth()],
    });
  }
  return out;
}

/* -------------------------------- includes --------------------------------- */

export const APPOINTMENT_INCLUDE = {
  customer: true,
  pet: true,
  service: true,
  provider: true,
  treatment: true,
  review: true,
} satisfies Prisma.AppointmentInclude;

export const PAYMENT_INCLUDE = {
  customer: true,
  appointment: { include: { service: true, pet: true } },
} satisfies Prisma.PaymentInclude;

export const TREATMENT_INCLUDE = {
  appointment: true,
  pet: true,
  provider: true,
} satisfies Prisma.TreatmentInclude;

export const REVIEW_INCLUDE = {
  customer: true,
  pet: true,
  service: true,
  provider: true,
  appointment: true,
} satisfies Prisma.ReviewInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;
export type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;
export type TreatmentWithRelations = Prisma.TreatmentGetPayload<{ include: typeof TREATMENT_INCLUDE }>;
export type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;
export type PetWithOwner = Pet & { owner?: User; _count?: { appointments: number } };
export type ServiceShapedInput = Service & { _count?: { appointments: number } };

/* --------------------------------- shapers --------------------------------- */

export function shapeAppointment(a: AppointmentWithRelations) {
  return {
    id: a.id,
    date: a.date,
    time: a.time,
    status: a.status,
    paymentStatus: a.paymentStatus,
    price: a.price,
    notes: a.notes,
    createdAt: a.createdAt,
    customer: { id: a.customer.id, name: a.customer.name, email: a.customer.email, phone: a.customer.phone },
    pet: { id: a.pet.id, name: a.pet.name, type: a.pet.type, breed: a.pet.breed, photo: a.pet.photo },
    service: {
      id: a.service.id,
      name: a.service.name,
      category: a.service.category,
      icon: a.service.icon,
      duration: a.service.duration,
      price: a.service.price,
    },
    provider: { id: a.provider.id, name: a.provider.name, specialty: a.provider.specialty },
    treatment: a.treatment ? { id: a.treatment.id } : null,
    review: a.review ? { id: a.review.id, rating: a.review.rating } : null,
  };
}

export function shapePet(p: PetWithOwner) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    breed: p.breed,
    gender: p.gender,
    birthDate: p.birthDate,
    weight: p.weight,
    color: p.color,
    photo: p.photo,
    medicalNotes: p.medicalNotes,
    vaccinationStatus: p.vaccinationStatus,
    ownerId: p.ownerId,
    createdAt: p.createdAt,
    ...(p.owner ? { owner: { id: p.owner.id, name: p.owner.name, email: p.owner.email, phone: p.owner.phone } } : {}),
    ...(p._count ? { _count: { appointments: p._count.appointments } } : {}),
  };
}

export function shapeService(s: ServiceShapedInput, agg?: { rating: number | null; reviewCount: number }) {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    duration: s.duration,
    price: s.price,
    icon: s.icon,
    active: s.active,
    createdAt: s.createdAt,
    rating: agg?.rating ?? null,
    reviewCount: agg?.reviewCount ?? 0,
    ...(s._count ? { _count: { appointments: s._count.appointments } } : {}),
  };
}

export function shapePayment(p: PaymentWithRelations) {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: p.amount,
    method: p.method,
    transactionId: p.transactionId,
    status: p.status,
    paidAt: p.paidAt,
    customer: { id: p.customer.id, name: p.customer.name, email: p.customer.email },
    appointment: {
      id: p.appointment.id,
      date: p.appointment.date,
      time: p.appointment.time,
      service: { name: p.appointment.service.name, icon: p.appointment.service.icon },
      pet: { name: p.appointment.pet.name },
    },
  };
}

export function shapeReview(r: ReviewWithRelations) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    createdAt: r.createdAt,
    customer: { id: r.customer.id, name: r.customer.name },
    pet: r.pet ? { id: r.pet.id, name: r.pet.name } : null,
    service: { id: r.service.id, name: r.service.name, icon: r.service.icon },
    provider: { id: r.provider.id, name: r.provider.name, specialty: r.provider.specialty },
    appointment: { id: r.appointment.id, date: r.appointment.date },
  };
}

export function shapeTreatment(t: TreatmentWithRelations) {
  return {
    id: t.id,
    symptoms: t.symptoms,
    diagnosis: t.diagnosis,
    treatmentPlan: t.treatmentPlan,
    prescription: t.prescription,
    medication: t.medication,
    dosage: t.dosage,
    followUpDate: t.followUpDate,
    notes: t.notes,
    createdAt: t.createdAt,
    appointment: {
      id: t.appointment.id,
      date: t.appointment.date,
      time: t.appointment.time,
      status: t.appointment.status,
    },
    pet: { id: t.pet.id, name: t.pet.name, type: t.pet.type },
    provider: { id: t.provider.id, name: t.provider.name, specialty: t.provider.specialty },
  };
}

/* ----------------------------- domain helpers ------------------------------ */

export async function getSetting() {
  const setting = await db.setting.findUnique({ where: { id: "main" } });
  if (setting) return setting;
  return db.setting.create({ data: {} });
}

/** Average APPROVED-review rating per service id (1 decimal). */
export async function serviceRatings(serviceIds: string[]): Promise<Map<string, { rating: number | null; reviewCount: number }>> {
  const map = new Map<string, { rating: number | null; reviewCount: number }>();
  if (serviceIds.length === 0) return map;
  const grouped = await db.review.groupBy({
    by: ["serviceId"],
    where: { serviceId: { in: serviceIds }, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const g of grouped) {
    map.set(g.serviceId, {
      rating: g._avg.rating == null ? null : Math.round(g._avg.rating * 10) / 10,
      reviewCount: g._count._all,
    });
  }
  return map;
}

/** Average APPROVED-review rating per provider id (1 decimal). */
export async function providerRatings(providerIds: string[]): Promise<Map<string, { rating: number | null; reviewCount: number }>> {
  const map = new Map<string, { rating: number | null; reviewCount: number }>();
  if (providerIds.length === 0) return map;
  const grouped = await db.review.groupBy({
    by: ["providerId"],
    where: { providerId: { in: providerIds }, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const g of grouped) {
    map.set(g.providerId, {
      rating: g._avg.rating == null ? null : Math.round(g._avg.rating * 10) / 10,
      reviewCount: g._count._all,
    });
  }
  return map;
}

export async function notify(userId: string, title: string, message: string, type: string) {
  await db.notification.create({ data: { userId, title, message, type } });
}

export async function notifyRoles(roles: string[], title: string, message: string, type: string) {
  const users = await db.user.findMany({ where: { role: { in: roles }, active: true }, select: { id: true } });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, title, message, type })),
  });
}

/** 409 when the provider already has a non-CANCELLED booking at that date/time. */
export async function assertSlotFree(providerId: string, date: string, time: string, excludeId?: string) {
  const clash = await db.appointment.findFirst({
    where: {
      providerId,
      date,
      time,
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ApiError("This time slot is already booked. Please choose a different slot.", 409);
}
