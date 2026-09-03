import { db } from "@/lib/db";
import { handleError, json, requireRole } from "@/lib/auth";
import {
  APPOINTMENT_INCLUDE,
  clinicDayBoundsUtc,
  clinicMonthKey,
  last6Months,
  shapeAppointment,
  todayStr,
} from "@/app/api/_lib/shape";

/** GET /api/dashboard/admin — AdminOverviewData. */
export async function GET(req: Request) {
  try {
    await requireRole(req, "ADMIN");
    const today = todayStr();
    const months = last6Months();

    // Everything below is aggregated in the database. This route used to pull every
    // appointment and every paid payment into memory and count them with Array.filter.
    const windowStartDate = `${months[0].key}-01`;
    const windowStart = clinicDayBoundsUtc(windowStartDate).start;

    const [
      totalCustomers,
      totalPets,
      todayAppointments,
      revenueAgg,
      pendingAppointments,
      activeProviders,
      byDate,
      byStatus,
      byService,
      windowPayments,
      recentRaw,
    ] = await Promise.all([
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.pet.count(),
      db.appointment.count({ where: { date: today, status: { not: "CANCELLED" } } }),
      db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      db.appointment.count({ where: { status: "PENDING" } }),
      db.user.count({ where: { role: { in: ["VET", "GROOMER"] }, active: true } }),
      // One row per calendar day in the window (~180 max), not one per appointment.
      db.appointment.groupBy({
        by: ["date"],
        where: { status: { not: "CANCELLED" }, date: { gte: windowStartDate } },
        _count: { _all: true },
      }),
      db.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
      db.appointment.groupBy({
        by: ["serviceId"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: 5,
      }),
      // Bounded to the charted window and to the two columns the chart needs.
      db.payment.findMany({
        where: { status: "PAID", paidAt: { gte: windowStart } },
        select: { amount: true, paidAt: true },
      }),
      db.appointment.findMany({
        include: APPOINTMENT_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    // 6-month chronological buckets with short month labels ("Jun").
    const countByMonth = new Map<string, number>();
    for (const row of byDate) {
      const key = row.date.slice(0, 7);
      countByMonth.set(key, (countByMonth.get(key) ?? 0) + row._count._all);
    }
    const appointmentsByMonth = months.map(({ key, label }) => ({
      month: label,
      count: countByMonth.get(key) ?? 0,
    }));

    const statusDistribution = byStatus
      .filter((row) => row._count._all > 0)
      .map((row) => ({ status: row.status, count: row._count._all }));

    const topServices = byService.length
      ? await db.service.findMany({
          where: { id: { in: byService.map((row) => row.serviceId) } },
          select: { id: true, name: true },
        })
      : [];
    const serviceNameById = new Map(topServices.map((s) => [s.id, s.name]));
    const popularServices = byService.map((row) => ({
      name: serviceNameById.get(row.serviceId) ?? "Service",
      count: row._count._all,
    }));

    // Revenue by clinic-local month. DateTime cannot be grouped by month without
    // raw SQL, so the window is narrowed to the six charted months instead.
    const revenueBucket = new Map<string, number>();
    for (const p of windowPayments) {
      const key = clinicMonthKey(p.paidAt);
      revenueBucket.set(key, (revenueBucket.get(key) ?? 0) + p.amount);
    }
    const revenueByMonth = months.map(({ key, label }) => ({
      month: label,
      amount: revenueBucket.get(key) ?? 0,
    }));

    return json({
      totalCustomers,
      totalPets,
      todayAppointments,
      totalRevenue: revenueAgg._sum.amount ?? 0,
      pendingAppointments,
      activeProviders,
      appointmentsByMonth,
      revenueByMonth,
      popularServices,
      statusDistribution,
      recentAppointments: recentRaw.map(shapeAppointment),
    });
  } catch (e) {
    return handleError(e);
  }
}
