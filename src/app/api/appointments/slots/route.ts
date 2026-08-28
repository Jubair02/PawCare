import { db } from "@/lib/db";
import { ApiError, handleError, json } from "@/lib/auth";
import { DATE_RE, asString, getSetting, minutesToTime, timeToMinutes, todayStr } from "@/app/api/_lib/shape";

/**
 * GET /api/appointments/slots — public. ?providerId=&date=
 * Generates slots from Setting openTime→closeTime step slotMinutes, excluding
 * non-CANCELLED bookings for that provider/date and past times when date is today.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const providerId = asString(url.searchParams.get("providerId"));
    const date = asString(url.searchParams.get("date"));

    if (!providerId) throw new ApiError("providerId is required.", 400);
    if (!date || !DATE_RE.test(date)) throw new ApiError("A valid date (yyyy-MM-dd) is required.", 400);

    const provider = await db.user.findFirst({
      where: { id: providerId, role: { in: ["VET", "GROOMER"] }, active: true },
      select: { id: true },
    });
    if (!provider) throw new ApiError("Provider not found.", 404);

    const setting = await getSetting();
    const open = timeToMinutes(setting.openTime);
    const close = timeToMinutes(setting.closeTime);
    const step = setting.slotMinutes;

    const slots: string[] = [];
    if (close > open && step > 0) {
      const booked = await db.appointment.findMany({
        where: { providerId, date, status: { not: "CANCELLED" } },
        select: { time: true },
      });
      const bookedSet = new Set(booked.map((b) => b.time));

      const isToday = date === todayStr();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (let t = open; t + step <= close; t += step) {
        const label = minutesToTime(t);
        if (bookedSet.has(label)) continue;
        if (isToday && t <= nowMinutes) continue; // exclude past times today
        slots.push(label);
      }
    }
    return json({ slots });
  } catch (e) {
    return handleError(e);
  }
}
