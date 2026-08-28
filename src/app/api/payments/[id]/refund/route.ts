import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { PAYMENT_INCLUDE, shapePayment } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/payments/:id/refund — ADMIN marks payment + appointment REFUNDED. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "ADMIN");
    const { id } = await ctx.params;

    const payment = await db.payment.findUnique({ where: { id } });
    if (!payment) throw new ApiError("Payment not found.", 404);
    if (payment.status === "REFUNDED") {
      throw new ApiError("This payment has already been refunded.", 400);
    }

    await db.$transaction([
      db.payment.update({ where: { id }, data: { status: "REFUNDED" } }),
      db.appointment.update({ where: { id: payment.appointmentId }, data: { paymentStatus: "REFUNDED" } }),
    ]);

    const full = await db.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
    if (!full) throw new ApiError("Payment could not be loaded.", 500);
    return json({ payment: shapePayment(full) });
  } catch (e) {
    return handleError(e);
  }
}
