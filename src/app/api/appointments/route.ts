import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole, requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import {
  APPOINTMENT_INCLUDE,
  DATE_RE,
  TIME_RE,
  asString,
  assertBookable,
  assertNoOverlap,
  getSetting,
  notify,
  notifyRoles,
  pageMeta,
  providerRoleForCategory,
  readBody,
  readPage,
  serializableWrite,
  shapeAppointment,
} from "@/app/api/_lib/shape";

/**
 * GET /api/appointments — role-scoped list.
 * ?status=&date=&from=&to=&q= — sorted date desc, time desc.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const where: Prisma.AppointmentWhereInput = {};

    // Scope by role
    if (user.role === "CUSTOMER") where.customerId = user.id;
    else if (user.role === "VET" || user.role === "GROOMER") where.providerId = user.id;
    // STAFF / ADMIN see everything

    const status = url.searchParams.get("status");
    if (status) where.status = status;

    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (date) {
      where.date = date;
    } else if (from || to) {
      where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    const q = url.searchParams.get("q");
    if (q) {
      where.OR = [
        { pet: { name: { contains: q, mode: "insensitive" } } },
        { service: { name: { contains: q, mode: "insensitive" } } },
        {
          customer: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        { provider: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const page = readPage(url);
    const [appointments, total] = await Promise.all([
      db.appointment.findMany({
        where,
        include: APPOINTMENT_INCLUDE,
        orderBy: [{ date: "desc" }, { time: "desc" }],
        ...page,
      }),
      db.appointment.count({ where }),
    ]);
    return json({ appointments: appointments.map(shapeAppointment), page: pageMeta(total, page) });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/appointments — CUSTOMER/STAFF/ADMIN booking with slot-conflict check. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, "CUSTOMER", "STAFF", "ADMIN");
    const body = await readBody(req);
    const petId = asString(body.petId);
    const serviceId = asString(body.serviceId);
    const providerId = asString(body.providerId);
    const date = asString(body.date);
    const time = asString(body.time);
    const notes = asString(body.notes);

    if (!petId) throw new ApiError("petId is required.", 400);
    if (!serviceId) throw new ApiError("serviceId is required.", 400);
    if (!providerId) throw new ApiError("providerId is required.", 400);
    if (!date || !DATE_RE.test(date)) throw new ApiError("A valid date (yyyy-MM-dd) is required.", 400);
    if (!time || !TIME_RE.test(time)) throw new ApiError("A valid time (HH:mm) is required.", 400);

    const pet = await db.pet.findUnique({ where: { id: petId }, include: { owner: true } });
    if (!pet) throw new ApiError("Pet not found.", 404);
    if (user.role === "CUSTOMER" && pet.ownerId !== user.id) {
      throw new ApiError("You can only book appointments for your own pets.", 403);
    }

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new ApiError("Service not found.", 404);
    if (!service.active) throw new ApiError("This service is currently unavailable.", 400);

    const provider = await db.user.findUnique({ where: { id: providerId } });
    if (!provider || !provider.active || (provider.role !== "VET" && provider.role !== "GROOMER")) {
      throw new ApiError("Provider not found or unavailable.", 400);
    }
    // The booking UI only offers matching providers, but the API accepted any of
    // them - a grooming session could be booked with a vet, or vice versa.
    const requiredRole = providerRoleForCategory(service.category);
    if (provider.role !== requiredRole) {
      throw new ApiError(
        `${service.name} is a ${service.category.toLowerCase()} service and must be booked with a ${
          requiredRole === "GROOMER" ? "groomer" : "vet"
        }.`,
        400,
      );
    }

    // Past dates, out-of-hours times and off-grid times are rejected here, not just in the UI.
    const setting = await getSetting();
    assertBookable(date, time, service.duration, setting);

    // Serializable isolation closes the check-then-write race: two concurrent bookings
    // for overlapping windows can no longer both pass the conflict check.
    const appointment = await serializableWrite(async (tx) => {
      await assertNoOverlap(tx, providerId, date, time, service.duration);
      return tx.appointment.create({
        data: {
          customerId: pet.ownerId,
          petId,
          serviceId,
          providerId,
          date,
          time,
          status: "PENDING",
          paymentStatus: "UNPAID",
          price: service.price,
          notes: notes ?? null,
        },
      });
    });

    const when = `${date} at ${time}`;
    await notify(
      providerId,
      "New appointment booked",
      `${pet.owner.name} booked ${service.name} for ${pet.name} on ${when}.`,
      "BOOKING",
    );
    await notify(
      pet.ownerId,
      "Appointment booked",
      `Your ${service.name} appointment for ${pet.name} is booked for ${when} and is pending confirmation.`,
      "BOOKING",
    );
    await notifyRoles(
      ["ADMIN", "STAFF"],
      "New booking received",
      `${pet.owner.name} booked ${service.name} for ${pet.name} with ${provider.name} on ${when}.`,
      "BOOKING",
    );

    const full = await db.appointment.findUnique({ where: { id: appointment.id }, include: APPOINTMENT_INCLUDE });
    if (!full) throw new ApiError("Appointment could not be loaded.", 500);
    return json({ appointment: shapeAppointment(full) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
