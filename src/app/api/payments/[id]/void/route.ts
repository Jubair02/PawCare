import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { PAYMENT_INCLUDE, notify, serializableWrite, shapePayment } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/payments/:id/void — STAFF/ADMIN write off a cash record that was
 * never collected.
 *
 * The refund route deliberately refuses PENDING payments ("nothing to refund"),
 * which previously left them stuck forever: not collectable once the
 * appointment was cancelled, and not refundable either. This is that missing
 * exit. It moves no money, so it is not a refund.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "STAFF", "ADMIN");
    const { id } = await ctx.params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: { appointment: { include: { service: true, pet: true } } },
    });
    if (!payment) throw new ApiError("Payment not found.", 404);
    if (payment.status === "PAID") {
      throw new ApiError("This payment was collected. Refund it instead of voiding it.", 409);
    }
    if (payment.status === "REFUNDED") {
      throw new ApiError("This payment was already refunded.", 409);
    }
    if (payment.status === "CANCELLED") {
      throw new ApiError("This payment has already been voided.", 409);
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

      await tx.payment.update({ where: { id }, data: { status: "CANCELLED" } });

      // Only drop the appointment back to UNPAID if nothing else still stands.
      const settled = await tx.payment.count({
        where: { appointmentId: fresh.appointmentId, status: { in: ["PAID", "PENDING"] } },
      });
      if (settled === 0) {
        await tx.appointment.update({
          where: { id: fresh.appointmentId },
          data: { paymentStatus: "UNPAID" },
        });
      }
    });

    await notify(
      payment.customerId,
      "Cash payment cancelled",
      `The outstanding cash balance of ৳${payment.amount} for ${payment.appointment.service.name} (${payment.appointment.pet.name}) has been written off. Invoice ${payment.invoiceId}.`,
      "PAYMENT",
    );

    const full = await db.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
    if (!full) throw new ApiError("Payment could not be loaded.", 500);
    return json({ payment: shapePayment(full) });
  } catch (e) {
    return handleError(e);
  }
}
