/**
 * Canonical domain vocabulary shared by the API and the UI.
 *
 * These lists and the status machine used to be declared twice — once in
 * `src/app/api/_lib/shape.ts` for the server and once in `src/lib/constants.ts`
 * for the client — and had already drifted: the client's copy was missing the
 * admin walk-in transition the server allows. Both sides now import from here.
 *
 * Keep this module dependency-free so it is safe on both the server and in the
 * browser bundle.
 */

export const ROLES = ["ADMIN", "STAFF", "VET", "GROOMER", "CUSTOMER"] as const;
export const PET_TYPE_VALUES = ["DOG", "CAT", "BIRD", "OTHER"] as const;
export const PET_GENDER_VALUES = ["MALE", "FEMALE"] as const;
export const VACCINATION_STATUS_VALUES = ["UP_TO_DATE", "PARTIAL", "NONE"] as const;
export const SERVICE_CATEGORY_VALUES = ["MEDICAL", "GROOMING", "DIAGNOSTIC"] as const;
export const PAYMENT_METHOD_VALUES = ["CASH", "CARD", "MOBILE"] as const;

/**
 * Payment-record states. CASH creates a PENDING record: the customer has chosen
 * to pay at the counter but no money has moved yet, so it must not be counted as
 * revenue. Staff move it to PAID when they actually take the cash.
 */
export const PAYMENT_RECORD_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;

/**
 * The appointment's view of payment. CASH_DUE means a cash payment is expected
 * at the front desk; it blocks a second payment attempt without claiming the
 * money has been received.
 */
export const APPOINTMENT_PAYMENT_STATUSES = ["UNPAID", "CASH_DUE", "PAID", "REFUNDED"] as const;

/** Cash is settled in person, so it cannot be self-served to PAID. */
export function isPayNowMethod(method: string): boolean {
  return method !== "CASH";
}
export const REVIEW_STATUSES = ["PENDING", "APPROVED", "HIDDEN"] as const;

export const ALL_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

/** Happy-path order, used for status columns and filter chips. */
export const STATUS_FLOW = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

/** Statuses that still occupy a slot in the calendar. */
export const ACTIVE_APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
] as const;

/** Base status machine. CANCELLED and COMPLETED are terminal. */
export const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Transitions available to `role` from `from`.
 *
 * ADMIN may additionally check a walk-in straight in from PENDING, skipping
 * confirmation. The server has always allowed this; the client's duplicated
 * table did not know about it, so the admin UI never offered the action.
 */
export function allowedTransitions(from: string, role: string): string[] {
  const base = [...(TRANSITIONS[from] ?? [])];
  if (role === "ADMIN" && from === "PENDING" && !base.includes("CHECKED_IN")) {
    base.push("CHECKED_IN");
  }
  return base;
}

/** The provider role that may deliver a service of this category. */
export function providerRoleForCategory(category: string): "VET" | "GROOMER" {
  return category === "GROOMING" ? "GROOMER" : "VET";
}
