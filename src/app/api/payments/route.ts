import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole, requireUser } from "@/lib/auth";
import type { Payment, Prisma } from "@prisma/client";
import { PAYMENT_INCLUDE, PAYMENT_METHODS, asString, notify, notifyRoles, pageMeta, readBody, readPage, shapeAppointment, shapePayment, APPOINTMENT_INCLUDE } from "@/app/api/_lib/shape";
import { isPayNowMethod } from "@/lib/domain";

/** GET /api/payments — role-scoped. ?status=&method= */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const where: Prisma.PaymentWhereInput = {};

    if (user.role === "CUSTOMER") {
      where.customerId = user.id;
    } else if (user.role === "VET" || user.role === "GROOMER") {
      where.appointment = { providerId: user.id };
    }
    // STAFF / ADMIN see everything

    const status = url.searchParams.get("status");
    if (status) where.status = status;
    const method = url.searchParams.get("method");
    if (method) where.method = method;

    const page = readPage(url);

    // Money totals are aggregated in the database across the whole filtered set.
    // The KPI cards used to sum the returned array, so past the page cap the
    // clinic's revenue simply stopped counting.
    const scope: Prisma.PaymentWhereInput = { ...where };
    delete (scope as { status?: unknown }).status;

    const [payments, total, byStatus] = await Promise.all([
      db.payment.findMany({ where, include: PAYMENT_INCLUDE, orderBy: { paidAt: "desc" }, ...page }),
      db.payment.count({ where }),
      db.payment.groupBy({ by: ["status"], where: scope, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    const summary = { paid: 0, pending: 0, refunded: 0, paidCount: 0, pendingCount: 0, refundedCount: 0 };
    for (const row of byStatus) {
      const amount = row._sum.amount ?? 0;
      if (row.status === "PAID") {
        summary.paid = amount;
        summary.paidCount = row._count._all;
      } else if (row.status === "PENDING") {
        summary.pending = amount;
        summary.pendingCount = row._count._all;
      } else if (row.status === "REFUNDED") {
        summary.refunded = amount;
        summary.refundedCount = row._count._all;
      }
    }

    return json({ payments: payments.map(shapePayment), page: pageMeta(total, page), summary });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/payments — mock pay {appointmentId, method}. CUSTOMER/STAFF/ADMIN. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, "CUSTOMER", "STAFF", "ADMIN");
    const body = await readBody(req);
    const appointmentId = asString(body.appointmentId);
    const method = asString(body.method);

    if (!appointmentId) throw new ApiError("appointmentId is required.", 400);
    if (!method || !PAYMENT_METHODS.includes(method)) {
      throw new ApiError("Payment method must be CASH, CARD or MOBILE.", 400);
    }

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { pet: true, service: true, customer: true },
    });
    if (!appointment) throw new ApiError("Appointment not found.", 404);
    if (user.role === "CUSTOMER" && appointment.customerId !== user.id) {
      throw new ApiError("You can only pay for your own appointments.", 403);
    }
    if (appointment.paymentStatus === "PAID") {
      throw new ApiError("This appointment has already been paid.", 409);
    }
    if (appointment.paymentStatus === "CASH_DUE") {
      throw new ApiError("A cash payment is already due for this appointment at the front desk.", 409);
    }
    if (appointment.status === "CANCELLED") {
      throw new ApiError("Cancelled appointments cannot be paid.", 409);
    }

    // Card and mobile settle instantly. Cash depends on who is recording it:
    // a customer choosing "cash" online is only promising to pay, so that books a
    // PENDING record; a staff member at the front desk is recording money that has
    // physically changed hands, so it settles immediately. Treating those the same
    // forced the desk into a two-step dance for every walk-in payment.
    const atFrontDesk = user.role === "STAFF" || user.role === "ADMIN";
    const payNow = isPayNowMethod(method) || atFrontDesk;
    const transactionId = `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    // The payment row and the appointment's paymentStatus move together or not at all.
    // Serializable isolation also stops two concurrent payments double-charging one
    // appointment; a collision on the sequential invoice id just retries with the next.
    let payment: Payment | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5 && !payment; attempt++) {
      try {
        payment = await db.$transaction(
          async (tx) => {
            // Re-read inside the transaction - a concurrent payment may have landed.
            const fresh = await tx.appointment.findUnique({
              where: { id: appointmentId },
              select: { status: true, paymentStatus: true },
            });
            if (!fresh) throw new ApiError("Appointment not found.", 404);
            if (fresh.paymentStatus === "PAID") {
              throw new ApiError("This appointment has already been paid.", 409);
            }
            if (fresh.paymentStatus === "CASH_DUE") {
              throw new ApiError("A cash payment is already due for this appointment.", 409);
            }
            if (fresh.status === "CANCELLED") {
              throw new ApiError("Cancelled appointments cannot be paid.", 409);
            }

            const invoiceId = `INV-${2001 + (await tx.payment.count()) + attempt}`;
            const created = await tx.payment.create({
              data: {
                invoiceId,
                appointmentId,
                customerId: appointment.customerId,
                amount: appointment.price,
                method,
                transactionId,
                status: payNow ? "PAID" : "PENDING",
              },
            });

            await tx.appointment.update({
              where: { id: appointmentId },
              data: {
                paymentStatus: payNow ? "PAID" : "CASH_DUE",
                // Only settled money confirms a booking; a cash intent does not.
                ...(payNow && fresh.status === "PENDING" ? { status: "CONFIRMED" } : {}),
              },
            });

            return created;
          },
          { isolationLevel: "Serializable" },
        );
      } catch (e) {
        if (e instanceof ApiError) throw e; // a real rejection, not a write conflict
        lastError = e;
      }
    }

    if (!payment) {
      if (lastError) throw lastError;
      throw new ApiError("Payment could not be completed. Please try again.", 500);
    }

    if (payNow) {
      await notify(
        appointment.customerId,
        "Payment successful",
        `Your payment of ৳${appointment.price} for ${appointment.service.name} (${appointment.pet.name}) was received. Invoice ${payment.invoiceId}.`,
        "PAYMENT",
      );
      await notifyRoles(
        ["ADMIN", "STAFF"],
        "Payment received",
        `A payment of ৳${appointment.price} was recorded for ${appointment.pet.name}'s ${appointment.service.name}. Invoice ${payment.invoiceId}.`,
        "PAYMENT",
      );
    } else {
      await notify(
        appointment.customerId,
        "Cash payment due at the clinic",
        `Please pay ৳${appointment.price} for ${appointment.service.name} (${appointment.pet.name}) at the front desk. Invoice ${payment.invoiceId}.`,
        "PAYMENT",
      );
      await notifyRoles(
        ["ADMIN", "STAFF"],
        "Cash payment expected",
        `${appointment.customer.name} will pay ৳${appointment.price} in cash for ${appointment.pet.name}'s ${appointment.service.name}. Invoice ${payment.invoiceId} is awaiting collection.`,
        "PAYMENT",
      );
    }

    const paymentId = payment.id;
    const fullPayment = await db.payment.findUnique({ where: { id: paymentId }, include: PAYMENT_INCLUDE });
    const fullAppointment = await db.appointment.findUnique({ where: { id: appointmentId }, include: APPOINTMENT_INCLUDE });
    if (!fullPayment || !fullAppointment) throw new ApiError("Payment could not be loaded.", 500);
    return json({ payment: shapePayment(fullPayment), appointment: shapeAppointment(fullAppointment) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
