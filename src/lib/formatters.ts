/**
 * Clinic timezone for display. Mirrors CLINIC_TZ on the server so a date shown
 * in a table matches the day the API counted it under.
 */
export const CLINIC_TZ = process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || "Asia/Dhaka";

/**
 * ISO instant → "2025-11-20" in clinic time.
 *
 * Replaces `new Date(iso).toISOString().slice(0, 10)`, which rendered the UTC
 * date: a payment taken at 02:00 in Dhaka was shown as the previous day.
 */
export function formatInstantDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA formats as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * ISO instant → "2:00 PM" in clinic time.
 *
 * Replaces `iso.slice(11, 16)`, which read the UTC wall clock: a payment taken
 * at 2 PM in Dhaka was shown as 8:00 AM.
 */
export function formatInstantTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Today's date as "yyyy-MM-dd" in clinic time.
 *
 * Every "today" in the UI must agree with the API, which buckets by CLINIC_TZ.
 * Deriving it from the browser clock put a Dhaka clinic a day out for anyone
 * whose machine was set to a western timezone.
 */
export function clinicToday(): string {
  return formatInstantDate(new Date().toISOString());
}

/** ৳ money with en-IN grouping: 1200 → "৳1,200" */
export function formatBDT(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);
  return `৳${formatted}`;
}

/** "2025-11-20" → "20 Nov 2025" (timezone-safe: parses yyyy-MM-dd as local date) */
export function formatDate(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dt);
}

/** "2025-11-20" → "20 Nov" (short, for compact lists) */
export function formatDateShort(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dt);
}

/** "14:00" → "2:00 PM" */
export function formatTime(time: string): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr) || 0;
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** ISO datetime → relative time ("just now", "5m ago", "3h ago", "2d ago", or date) */
export function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(dt);
}

/**
 * "yyyy-MM-dd" → past / today / future against *clinic* today.
 *
 * Both sides are yyyy-MM-dd, which sorts lexicographically, so no Date parsing
 * is needed — and no browser timezone can shift the comparison.
 */
export function dateRelation(date: string): "past" | "today" | "future" {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "future";
  const today = clinicToday();
  if (date === today) return "today";
  return date < today ? "past" : "future";
}

/** Pet type → emoji: DOG🐶 CAT🐱 BIRD🐦 OTHER🐾 */
export function petEmoji(type: string): string {
  switch (type) {
    case "DOG":
      return "🐶";
    case "CAT":
      return "🐱";
    case "BIRD":
      return "🐦";
    default:
      return "🐾";
  }
}

/** "Rahim Uddin" → "RU" (first letters of first two words, uppercase) */
export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * An arbitrary `Date` → "yyyy-MM-dd", read off the local calendar.
 *
 * This is for date *arithmetic* — week boundaries, day columns — where the
 * caller has already built a Date at local midnight and just needs its label.
 * For "what day is it now", use `clinicToday()` instead: that one agrees with
 * the API, which buckets everything by CLINIC_TZ.
 */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * "2021-03-14" → "4 yrs 2 mos". `null` when the date is missing, unparseable or
 * in the future, so callers choose their own placeholder.
 *
 * Replaces four near-identical copies (`ageLabel`, `ageFromBirthDate`, `calcAge`)
 * that each formatted the same calculation differently.
 */
export function petAge(birthDate?: string | null): string | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const born = new Date(y, m - 1, d);
  const now = new Date();
  if (born.getTime() > now.getTime()) return null;

  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return null;
  if (months === 0) return "Newborn";

  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yearLabel = `${years} yr${years === 1 ? "" : "s"}`;
  const monthLabel = `${rem} mo${rem === 1 ? "" : "s"}`;
  if (years === 0) return monthLabel;
  if (rem === 0) return yearLabel;
  return `${yearLabel} ${monthLabel}`;
}
