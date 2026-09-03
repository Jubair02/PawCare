import { db } from "@/lib/db";
import { ApiError, handleError, json } from "@/lib/auth";
import {
  DATE_RE,
  asString,
  clinicNowMinutes,
  getSetting,
  minutesToTime,
  slotWindow,
  timeToMinutes,
  todayStr,
} from "@/app/api/_lib/shape";

/**
 * GET /api/appointments/slots — public. ?providerId=&date=&serviceId=
 * Generates slots from Setting openTime→closeTime step slotMinutes, dropping any
 * that overlap a non-CANCELLED booking (real service durations, not just equal
 * start times) or that have already passed in the clinic timezone.
 *
 * Pass `serviceId` so slots too close to closing time for that service are hidden.
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

    // The booked service decides how much room a slot needs; default to one grid step.
    let duration = step;
    const serviceId = asString(url.searchParams.get("serviceId"));
    if (serviceId) {
      const service = await db.service.findUnique({
        where: { id: serviceId },
        select: { duration: true, active: true },
      });
      if (!service) throw new ApiError("Service not found.", 404);
      if (!service.active) throw new ApiError("This service is currently unavailable.", 400);
      duration = service.duration;
    }

    const slots: string[] = [];
    if (close > open && step > 0 && duration > 0) {
      const booked = await db.appointment.findMany({
        where: { providerId, date, status: { not: "CANCELLED" } },
        select: { time: true, service: { select: { duration: true } } },
      });
      const busy = booked.map((b) => slotWindow(b.time, b.service.duration));

      const isToday = date === todayStr();
      const nowMinutes = clinicNowMinutes();

      for (let t = open; t + duration <= close; t += step) {
        if (isToday && t <= nowMinutes) continue; // already passed, clinic time
        const want = { start: t, end: t + duration };
        if (busy.some((b) => want.start < b.end && b.start < want.end)) continue;
        slots.push(minutesToTime(t));
      }
    }
    return json({ slots });
  } catch (e) {
    return handleError(e);
  }
}
