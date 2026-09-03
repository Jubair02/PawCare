import { db } from "@/lib/db";
import { handleError, json, requireRole } from "@/lib/auth";
import { APPOINTMENT_INCLUDE, clinicDayBoundsUtc, shapeAppointment, todayStr } from "@/app/api/_lib/shape";

/** GET /api/dashboard/staff — StaffDashboardData. */
export async function GET(req: Request) {
  try {
    await requireRole(req, "STAFF");
    const today = todayStr();
    // Same clinic day the appointment counts use - previously this was server-local
    // midnight while `today` was a UTC date, so the two panels covered different windows.
    const { start: dayStart, end: dayEnd } = clinicDayBoundsUtc(today);

    const [todayAppointments, pendingAppointments, checkedInToday, revenueToday, totalCustomers, totalPets, scheduleRaw] =
      await Promise.all([
        db.appointment.count({ where: { date: today, status: { not: "CANCELLED" } } }),
        db.appointment.count({ where: { status: "PENDING" } }),
        db.appointment.count({ where: { date: today, status: { in: ["CHECKED_IN", "IN_PROGRESS"] } } }),
        db.payment.aggregate({
          where: { status: "PAID", paidAt: { gte: dayStart, lt: dayEnd } },
          _sum: { amount: true },
        }),
        db.user.count({ where: { role: "CUSTOMER" } }),
        db.pet.count(),
        db.appointment.findMany({
          where: { date: today },
          include: APPOINTMENT_INCLUDE,
          orderBy: { time: "asc" },
        }),
      ]);

    return json({
      todayAppointments,
      pendingAppointments,
      checkedInToday,
      revenueToday: revenueToday._sum.amount ?? 0,
      totalCustomers,
      totalPets,
      todaySchedule: scheduleRaw.map(shapeAppointment),
    });
  } catch (e) {
    return handleError(e);
  }
}
