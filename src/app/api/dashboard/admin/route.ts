import { db } from "@/lib/db";
import { handleError, json, requireRole } from "@/lib/auth";
import { APPOINTMENT_INCLUDE, last6Months, shapeAppointment, todayStr } from "@/app/api/_lib/shape";

/** GET /api/dashboard/admin — AdminOverviewData. */
export async function GET(req: Request) {
  try {
    await requireRole(req, "ADMIN");
    const today = todayStr();
    const months = last6Months();

    const [totalCustomers, totalPets, todayAppointments, revenueAgg, pendingAppointments, activeProviders, allAppointments, paidPayments, recentRaw] =
      await Promise.all([
        db.user.count({ where: { role: "CUSTOMER" } }),
        db.pet.count(),
        db.appointment.count({ where: { date: today, status: { not: "CANCELLED" } } }),
        db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
        db.appointment.count({ where: { status: "PENDING" } }),
        db.user.count({ where: { role: { in: ["VET", "GROOMER"] }, active: true } }),
        db.appointment.findMany({ select: { date: true, status: true, serviceId: true } }),
        db.payment.findMany({ where: { status: "PAID" }, select: { amount: true, paidAt: true } }),
        db.appointment.findMany({
          include: APPOINTMENT_INCLUDE,
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
      ]);

    // 6-month chronological buckets with short month labels ("Jun").
    const appointmentsByMonth = months.map(({ key, label }) => ({
      month: label,
      count: allAppointments.filter((a) => a.date.startsWith(key) && a.status !== "CANCELLED").length,
    }));

    const statusCounts = new Map<string, number>();
    for (const a of allAppointments) {
      statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
    }
    const statusDistribution = Array.from(statusCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count }));

    const serviceCounts = new Map<string, number>();
    for (const a of allAppointments) {
      if (a.status === "CANCELLED") continue;
      serviceCounts.set(a.serviceId, (serviceCounts.get(a.serviceId) ?? 0) + 1);
    }
    const top5 = Array.from(serviceCounts.entries())
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5);
    const topServices = top5.length
      ? await db.service.findMany({ where: { id: { in: top5.map(([id]) => id) } }, select: { id: true, name: true } })
      : [];
    const serviceNameById = new Map(topServices.map((s) => [s.id, s.name]));
    const popularServices = top5.map(([id, count]) => ({ name: serviceNameById.get(id) ?? "Service", count }));

    // Revenue from PAID payments grouped by paidAt month.
    const revenueByMonth = months.map(({ key, label }) => {
      const amount = paidPayments
        .filter((p) => {
          const k = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, "0")}`;
          return k === key;
        })
        .reduce((sum, p) => sum + p.amount, 0);
      return { month: label, amount };
    });

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
