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

/** "yyyy-MM-dd" → { isPast, isToday, isFuture } vs local today (dates are day-granular) */
export function dateRelation(date: string): "past" | "today" | "future" {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "future";
  const dt = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = dt.getTime() - today.getTime();
  if (diff === 0) return "today";
  return diff < 0 ? "past" : "future";
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
