import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole, requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { PAYMENT_INCLUDE, PAYMENT_METHODS, asString, notify, notifyRoles, readBody, shapeAppointment, shapePayment, APPOINTMENT_INCLUDE } from "@/app/api/_lib/shape";

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

    const payments = await db.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { paidAt: "desc" },
    });
    return json({ payments: payments.map(shapePayment) });
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
    if (appointment.status === "CANCELLED") {
      throw new ApiError("Cancelled appointments cannot be paid.", 409);
    }

    // Sequential invoice id: INV-<2000 + payment count>, bumping on rare collisions.
    let seq = 2001 + (await db.payment.count());
    let invoiceId = `INV-${seq}`;
    while (await db.payment.findUnique({ where: { invoiceId }, select: { id: true } })) {
      seq += 1;
      invoiceId = `INV-${seq}`;
    }
    const transactionId = `TXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    const payment = await db.payment.create({
      data: {
        invoiceId,
        appointmentId,
        customerId: appointment.customerId,
        amount: appointment.price,
        method,
        transactionId,
        status: "PAID",
      },
    });

    await db.appointment.update({
      where: { id: appointmentId },
      data: {
        paymentStatus: "PAID",
        ...(appointment.status === "PENDING" ? { status: "CONFIRMED" } : {}),
      },
    });

    await notify(
      appointment.customerId,
      "Payment successful",
      `Your payment of ৳${appointment.price} for ${appointment.service.name} (${appointment.pet.name}) was received. Invoice ${invoiceId}.`,
      "PAYMENT",
    );
    await notifyRoles(
      ["ADMIN", "STAFF"],
      "Payment received",
      `A payment of ৳${appointment.price} was recorded for ${appointment.pet.name}'s ${appointment.service.name}. Invoice ${invoiceId}.`,
      "PAYMENT",
    );

    const fullPayment = await db.payment.findUnique({ where: { id: payment.id }, include: PAYMENT_INCLUDE });
    const fullAppointment = await db.appointment.findUnique({ where: { id: appointmentId }, include: APPOINTMENT_INCLUDE });
    if (!fullPayment || !fullAppointment) throw new ApiError("Payment could not be loaded.", 500);
    return json({ payment: shapePayment(fullPayment), appointment: shapeAppointment(fullAppointment) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
