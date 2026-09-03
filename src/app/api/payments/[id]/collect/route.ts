import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { PAYMENT_INCLUDE, notify, serializableWrite, shapePayment } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/payments/:id/collect — STAFF/ADMIN record that a cash payment was
 * actually handed over at the front desk.
 *
 * Customers can only ever create a PENDING cash record; this is the only route
 * that turns one into revenue, which is what keeps the revenue figures honest.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const staff = await requireRole(req, "STAFF", "ADMIN");
    const { id } = await ctx.params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: { appointment: { include: { service: true, pet: true } } },
    });
    if (!payment) throw new ApiError("Payment not found.", 404);
    if (payment.status === "PAID") {
      throw new ApiError("This payment has already been collected.", 409);
    }
    if (payment.status === "REFUNDED") {
      throw new ApiError("This payment was refunded and cannot be collected.", 409);
    }

    await serializableWrite(async (tx) => {
      const fresh = await tx.payment.findUnique({
        where: { id },
        select: { status: true, appointmentId: true },
      });
      if (!fresh) throw new ApiError("Payment not found.", 404);
      if (fresh.status !== "PENDING") {
        throw new ApiError("This payment is no longer awaiting collection.", 409);
      }

      const appointment = await tx.appointment.findUnique({
        where: { id: fresh.appointmentId },
        select: { status: true },
      });

      await tx.payment.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
      await tx.appointment.update({
        where: { id: fresh.appointmentId },
        data: {
          paymentStatus: "PAID",
          // Settling the bill confirms a booking that was still pending.
          ...(appointment?.status === "PENDING" ? { status: "CONFIRMED" } : {}),
        },
      });
    });

    await notify(
      payment.customerId,
      "Cash payment received",
      `We received your cash payment of ৳${payment.amount} for ${payment.appointment.service.name} (${payment.appointment.pet.name}). Invoice ${payment.invoiceId}.`,
      "PAYMENT",
    );

    const full = await db.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
    if (!full) throw new ApiError("Payment could not be loaded.", 500);
    return json({ payment: shapePayment(full), collectedBy: staff.name });
  } catch (e) {
    return handleError(e);
  }
}
