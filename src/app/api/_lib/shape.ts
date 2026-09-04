/**
 * Shared backend helpers for PawCare API routes.
 * Lives in a private (`_`-prefixed) folder inside `src/app/api/**` so Next.js
 * never treats it as a route segment.
 */
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import {
  ACTIVE_APPOINTMENT_STATUSES as DOMAIN_ACTIVE_STATUSES,
  ALL_STATUSES as DOMAIN_ALL_STATUSES,
  PAYMENT_METHOD_VALUES,
  PET_GENDER_VALUES,
  PET_TYPE_VALUES,
  REVIEW_STATUSES as DOMAIN_REVIEW_STATUSES,
  ROLES as DOMAIN_ROLES,
  SERVICE_CATEGORY_VALUES,
  VACCINATION_STATUS_VALUES,
} from "@/lib/domain";
import type { Pet, Prisma, Service, Setting, User } from "@prisma/client";

/** Prisma client or an interactive-transaction client - lets helpers run inside `$transaction`. */
export type DbClient = typeof db | Prisma.TransactionClient;

/* ---------------------------------- consts --------------------------------- */

// The domain vocabulary lives in one place now (src/lib/domain.ts) so the API
// and the UI cannot drift apart. Re-exported here as mutable string arrays so
// existing `.includes(...)` checks in the routes keep working unchanged.
export const ROLES: string[] = [...DOMAIN_ROLES];
export const PET_TYPES: string[] = [...PET_TYPE_VALUES];
export const PET_GENDERS: string[] = [...PET_GENDER_VALUES];
export const VACCINATION_STATUSES: string[] = [...VACCINATION_STATUS_VALUES];
export const SERVICE_CATEGORIES: string[] = [...SERVICE_CATEGORY_VALUES];
export const PAYMENT_METHODS: string[] = [...PAYMENT_METHOD_VALUES];
export const REVIEW_STATUSES: string[] = [...DOMAIN_REVIEW_STATUSES];
export const ALL_STATUSES: string[] = [...DOMAIN_ALL_STATUSES];
export const ACTIVE_APPOINTMENT_STATUSES: string[] = [...DOMAIN_ACTIVE_STATUSES];

export { allowedTransitions, providerRoleForCategory, TRANSITIONS } from "@/lib/domain";

export const EMAIL_RE = /^\S+@\S+\.\S+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------ body & params ------------------------------ */

/** Hard ceiling on a JSON request body, so a huge payload cannot be buffered. */
export const MAX_BODY_BYTES = 1_000_000;

/** Pet photos are stored inline in a text column, so their size is capped. */
export const MAX_PHOTO_BYTES = 400 * 1024;

const DATA_URI_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i;
const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Validates a pet photo. The client caps uploads at 400KB but that is only a
 * courtesy - without this the API accepted an unbounded base64 string straight
 * into the database.
 */
export function assertValidPhoto(photo: string) {
  if (photo === "") return;

  const isDataUri = DATA_URI_RE.test(photo);
  const isHttp = HTTP_URL_RE.test(photo);
  if (!isDataUri && !isHttp) {
    throw new ApiError("Photo must be a base64 image data URI or an http(s) URL.", 400);
  }
  if (isHttp) {
    if (photo.length > 2048) throw new ApiError("Photo URL is too long.", 400);
    return;
  }

  // base64 encodes 3 bytes per 4 characters.
  const payload = photo.length - photo.indexOf(",") - 1;
  if (Math.floor((payload * 3) / 4) > MAX_PHOTO_BYTES) {
    throw new ApiError("Pet photo must be under 400KB.", 400);
  }
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new ApiError("Request body is too large.", 413);
  }
  // Content-Length is a client-supplied hint: it can be absent (chunked) or a
  // lie. Measure what actually arrived before parsing it.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return {};
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new ApiError("Request body is too large.", 413);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

/**
 * Per-field length caps. Postgres `text` is unbounded, so without these the API
 * happily stored a 20,000-character name.
 */
export const MAX_LEN = {
  NAME: 120,
  EMAIL: 254,
  PASSWORD: 200,
  PHONE: 40,
  SHORT: 120,
  BIO: 2000,
  NOTES: 2000,
  COMMENT: 2000,
  LONG: 5000,
} as const;

export function assertMaxLen(value: string | undefined, max: number, label: string) {
  if (value !== undefined && value.length > max) {
    throw new ApiError(`${label} must be ${max} characters or fewer.`, 400);
  }
}

export function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

/** `asString` with a length cap. Use for anything free-text a user can type. */
export function asBoundedString(v: unknown, max: number, label: string): string | undefined {
  const value = asString(v);
  assertMaxLen(value, max, label);
  return value;
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

/**
 * The clinic's wall-clock timezone. Every "today", "now" and month bucket in the
 * API derives from this, so UTC and local-time servers agree on which day it is.
 */
export const CLINIC_TZ = process.env.CLINIC_TIMEZONE || "Asia/Dhaka";

const CLINIC_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const pad2 = (n: number) => String(n).padStart(2, "0");

function clinicParts(d: Date) {
  const parts = CLINIC_PARTS.formatToParts(d);
  const get = (type: string) => Number(parts.find((x) => x.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Milliseconds the clinic timezone is ahead of UTC at that instant (DST-aware). */
function clinicOffsetMs(d: Date): number {
  const p = clinicParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** UTC instant of clinic-local midnight for a y/m/d, refined once for DST edges. */
function clinicMidnightUtc(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  let ms = guess - clinicOffsetMs(new Date(guess));
  ms = guess - clinicOffsetMs(new Date(ms));
  return new Date(ms);
}

/** Half-open [start, end) UTC instants covering one clinic-local calendar day. */
export function clinicDayBoundsUtc(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split("-").map(Number);
  const start = clinicMidnightUtc(y, m, d);
  const next = new Date(Date.UTC(y, m - 1, d + 1)); // Date.UTC normalises overflow
  const end = clinicMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return { start, end };
}

/** Today's date in the clinic timezone as `yyyy-MM-dd`. */
export function todayStr(): string {
  const p = clinicParts(new Date());
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Minutes since clinic-local midnight, right now. */
export function clinicNowMinutes(): number {
  const p = clinicParts(new Date());
  return p.hour * 60 + p.minute;
}

/** `yyyy-MM` bucket key for an instant, in the clinic timezone. */
export function clinicMonthKey(d: Date): string {
  const p = clinicParts(d);
  return `${p.year}-${pad2(p.month)}`;
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
  const p = clinicParts(new Date());
  const out: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`,
      label: MONTHS_SHORT[d.getUTCMonth()],
    });
  }
  return out;
}

/* -------------------------------- paging ----------------------------------- */

/**
 * List endpoints are bounded. Without this every `findMany` returned the whole
 * table, so payload and query cost grew without limit as the clinic filled up.
 */
export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 500;

export interface PageParams {
  take: number;
  skip: number;
}

/** Reads `?limit=&offset=`, clamped to [1, MAX_PAGE_SIZE] and >= 0. */
export function readPage(url: URL): PageParams {
  const limit = asNumber(url.searchParams.get("limit"));
  const offset = asNumber(url.searchParams.get("offset"));
  return {
    take:
      limit === undefined
        ? DEFAULT_PAGE_SIZE
        : Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE),
    skip: offset === undefined ? 0 : Math.max(Math.trunc(offset), 0),
  };
}

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Metadata so a client can tell it is looking at a subset, and ask for the rest. */
export function pageMeta(total: number, { take, skip }: PageParams): PageMeta {
  return { total, limit: take, offset: skip, hasMore: skip + take < total };
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

/**
 * Runs `fn` in a Serializable transaction, retrying the write conflicts Postgres
 * raises (P2034 / 40001) when concurrent transactions touch overlapping rows.
 * An `ApiError` is a deliberate rejection - it is rethrown, never retried.
 */
export async function serializableWrite<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 4,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await db.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/** The minute window `[start, end)` an appointment of `duration` occupies. */
export function slotWindow(time: string, duration: number): { start: number; end: number } {
  const start = timeToMinutes(time);
  return { start, end: start + Math.max(duration, 1) };
}

/**
 * 409 when the requested window overlaps any non-CANCELLED booking for the provider.
 * Compares real service durations, so a 90-minute visit at 09:00 also blocks 10:00.
 *
 * Pass the transaction client when calling inside `$transaction`: at Serializable
 * isolation that makes this check-then-write atomic against a concurrent booking.
 */
export async function assertNoOverlap(
  client: DbClient,
  providerId: string,
  date: string,
  time: string,
  duration: number,
  excludeId?: string,
) {
  const want = slotWindow(time, duration);
  const sameDay = await client.appointment.findMany({
    where: {
      providerId,
      date,
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { time: true, service: { select: { duration: true } } },
  });

  const clash = sameDay.find((a) => {
    const other = slotWindow(a.time, a.service.duration);
    return want.start < other.end && other.start < want.end;
  });
  if (clash) {
    throw new ApiError(
      `This time overlaps an existing booking at ${clash.time}. Please choose a different slot.`,
      409,
    );
  }
}

/**
 * Rejects bookings in the past, outside opening hours, or off the slot grid.
 * The `min` attribute on the client's date input is decoration - this is the real gate.
 */
export function assertBookable(date: string, time: string, duration: number, setting: Setting) {
  const today = todayStr();
  if (date < today) {
    throw new ApiError("Appointments cannot be booked in the past.", 400);
  }

  const open = timeToMinutes(setting.openTime);
  const close = timeToMinutes(setting.closeTime);
  if (!(close > open)) {
    throw new ApiError("Clinic opening hours are misconfigured. Please contact the clinic.", 409);
  }

  const start = timeToMinutes(time);
  if (date === today && start <= clinicNowMinutes()) {
    throw new ApiError("That time has already passed today. Please choose a later slot.", 400);
  }
  if (start < open || start + duration > close) {
    throw new ApiError(
      `Appointments must start and finish within opening hours (${setting.openTime}-${setting.closeTime}).`,
      400,
    );
  }
  if (setting.slotMinutes > 0 && (start - open) % setting.slotMinutes !== 0) {
    throw new ApiError(`Start time must align to a ${setting.slotMinutes}-minute slot.`, 400);
  }
}
