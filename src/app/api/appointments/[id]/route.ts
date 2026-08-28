import { db } from "@/lib/db";
import { ApiError, handleError, json, requireUser } from "@/lib/auth";
import {
  APPOINTMENT_INCLUDE,
  DATE_RE,
  TIME_RE,
  asString,
  assertSlotFree,
  notify,
  readBody,
  shapeAppointment,
} from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/appointments/:id — involved customer/provider or STAFF/ADMIN. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const appointment = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    if (!appointment) throw new ApiError("Appointment not found.", 404);

    const involved = appointment.customerId === user.id || appointment.providerId === user.id;
    if (!involved && user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new ApiError("You don't have access to this appointment.", 403);
    }
    return json({ appointment: shapeAppointment(appointment) });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * PATCH /api/appointments/:id — reschedule (date/time/notes).
 * STAFF/ADMIN anytime; the owning customer only while status is PENDING.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const appointment = await db.appointment.findUnique({ where: { id } });
    if (!appointment) throw new ApiError("Appointment not found.", 404);

    const isStaffAdmin = user.role === "STAFF" || user.role === "ADMIN";
    const isOwner = appointment.customerId === user.id;
    if (!isStaffAdmin && !isOwner) {
      throw new ApiError("You don't have access to this appointment.", 403);
    }
    if (!isStaffAdmin && appointment.status !== "PENDING") {
      throw new ApiError("Only pending appointments can be rescheduled. Please contact us to change a confirmed booking.", 403);
    }

    const body = await readBody(req);
    const date = asString(body.date);
    const time = asString(body.time);
    const notes = asString(body.notes);

    if (date !== undefined && !DATE_RE.test(date)) throw new ApiError("Invalid date format. Use yyyy-MM-dd.", 400);
    if (time !== undefined && !TIME_RE.test(time)) throw new ApiError("Invalid time format. Use HH:mm.", 400);

    const newDate = date ?? appointment.date;
    const newTime = time ?? appointment.time;
    const slotChanged = newDate !== appointment.date || newTime !== appointment.time;
    if (slotChanged) {
      await assertSlotFree(appointment.providerId, newDate, newTime, id);
    }

    await db.appointment.update({
      where: { id },
      data: {
        ...(date !== undefined ? { date } : {}),
        ...(time !== undefined ? { time } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    const full = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    if (!full) throw new ApiError("Appointment could not be loaded.", 500);

    await notify(
      full.providerId,
      "Appointment rescheduled",
      `${full.pet.name}'s ${full.service.name} appointment was rescheduled to ${full.date} at ${full.time}.`,
      "BOOKING",
    );
    await notify(
      full.customerId,
      "Appointment rescheduled",
      `Your ${full.service.name} appointment for ${full.pet.name} was rescheduled to ${full.date} at ${full.time}.`,
      "BOOKING",
    );

    return json({ appointment: shapeAppointment(full) });
  } catch (e) {
    return handleError(e);
  }
}
