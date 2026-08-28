import { db } from "@/lib/db";
import { handleError, json, requireRole } from "@/lib/auth";
import { ACTIVE_APPOINTMENT_STATUSES, APPOINTMENT_INCLUDE, shapeAppointment, todayStr } from "@/app/api/_lib/shape";

/** GET /api/dashboard/customer — CustomerDashboardData. */
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, "CUSTOMER");
    const today = todayStr();

    const [totalPets, upcomingAppointments, completedServices, unpaid, unreadNotifications, recentRaw, nextRaw] =
      await Promise.all([
        db.pet.count({ where: { ownerId: user.id } }),
        db.appointment.count({
          where: { customerId: user.id, date: { gte: today }, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
        }),
        db.appointment.count({ where: { customerId: user.id, status: "COMPLETED" } }),
        db.appointment.findMany({
          where: { customerId: user.id, paymentStatus: "UNPAID", status: { not: "CANCELLED" } },
          select: { price: true },
        }),
        db.notification.count({ where: { userId: user.id, read: false } }),
        db.appointment.findMany({
          where: { customerId: user.id },
          include: APPOINTMENT_INCLUDE,
          orderBy: [{ date: "desc" }, { time: "desc" }],
          take: 5,
        }),
        db.appointment.findFirst({
          where: { customerId: user.id, date: { gte: today }, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
          include: APPOINTMENT_INCLUDE,
          orderBy: [{ date: "asc" }, { time: "asc" }],
        }),
      ]);

    return json({
      totalPets,
      upcomingAppointments,
      completedServices,
      pendingPayments: unpaid.length,
      pendingAmount: unpaid.reduce((sum, a) => sum + a.price, 0),
      unreadNotifications,
      recentAppointments: recentRaw.map(shapeAppointment),
      nextAppointment: nextRaw ? shapeAppointment(nextRaw) : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
