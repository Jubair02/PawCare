import { db } from "@/lib/db";
import { handleError, json, requireRole } from "@/lib/auth";
import { APPOINTMENT_INCLUDE, shapeAppointment, todayStr } from "@/app/api/_lib/shape";

/** GET /api/dashboard/provider — ProviderDashboardData (VET/GROOMER). */
export async function GET(req: Request) {
  try {
    const user = await requireRole(req, "VET", "GROOMER");
    const today = todayStr();

    const [todayAppointments, pendingAppointments, completedToday, totalPatients, scheduleRaw] = await Promise.all([
      db.appointment.count({ where: { providerId: user.id, date: today, status: { not: "CANCELLED" } } }),
      db.appointment.count({ where: { providerId: user.id, status: "PENDING" } }),
      db.appointment.count({ where: { providerId: user.id, date: today, status: "COMPLETED" } }),
      db.pet.count({ where: { appointments: { some: { providerId: user.id } } } }),
      db.appointment.findMany({
        where: { providerId: user.id, date: today, status: { not: "CANCELLED" } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { time: "asc" },
      }),
    ]);

    return json({
      todayAppointments,
      pendingAppointments,
      completedToday,
      totalPatients,
      todaySchedule: scheduleRaw.map(shapeAppointment),
    });
  } catch (e) {
    return handleError(e);
  }
}
