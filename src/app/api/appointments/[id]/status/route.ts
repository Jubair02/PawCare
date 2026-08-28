import { db } from "@/lib/db";
import { ApiError, handleError, json, requireUser } from "@/lib/auth";
import {
  ALL_STATUSES,
  APPOINTMENT_INCLUDE,
  TRANSITIONS,
  asString,
  notify,
  readBody,
  shapeAppointment,
} from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/appointments/:id/status — enforce the status machine:
 * PENDING→CONFIRMED|CANCELLED; CONFIRMED→CHECKED_IN|CANCELLED;
 * CHECKED_IN→IN_PROGRESS|CANCELLED; IN_PROGRESS→COMPLETED.
 * CUSTOMER may only CANCEL their own appointment; ADMIN may also walk-in PENDING→CHECKED_IN.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const appointment = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    if (!appointment) throw new ApiError("Appointment not found.", 404);

    const body = await readBody(req);
    const target = asString(body.status);
    if (!target || !ALL_STATUSES.includes(target)) {
      throw new ApiError("Invalid status value.", 400);
    }

    if (user.role === "CUSTOMER") {
      if (appointment.customerId !== user.id) {
        throw new ApiError("You don't have access to this appointment.", 403);
      }
      if (target !== "CANCELLED") {
        throw new ApiError("Customers can only cancel appointments.", 403);
      }
    }

    if (target === appointment.status) {
      throw new ApiError(`Appointment is already ${appointment.status}.`, 400);
    }

    const allowed = [...(TRANSITIONS[appointment.status] ?? [])];
    if (user.role === "ADMIN" && appointment.status === "PENDING" && target === "CHECKED_IN") {
      allowed.push("CHECKED_IN"); // walk-in
    }
    if (!allowed.includes(target)) {
      throw new ApiError(`Invalid status transition from ${appointment.status} to ${target}.`, 400);
    }

    await db.appointment.update({ where: { id }, data: { status: target } });

    // Notifications: customer always; provider when a customer cancels.
    const label = target.replace(/_/g, " ");
    await notify(
      appointment.customerId,
      "Appointment status updated",
      `Your ${appointment.service.name} appointment for ${appointment.pet.name} on ${appointment.date} at ${appointment.time} is now ${label}.`,
      "STATUS",
    );
    if (target === "CANCELLED" && user.role === "CUSTOMER") {
      await notify(
        appointment.providerId,
        "Appointment cancelled",
        `${appointment.customer.name} cancelled the ${appointment.service.name} appointment for ${appointment.pet.name} on ${appointment.date} at ${appointment.time}.`,
        "STATUS",
      );
    }

    const full = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    if (!full) throw new ApiError("Appointment could not be loaded.", 500);
    return json({ appointment: shapeAppointment(full) });
  } catch (e) {
    return handleError(e);
  }
}
