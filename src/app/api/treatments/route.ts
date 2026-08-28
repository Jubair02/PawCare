import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole, requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { TREATMENT_INCLUDE, asString, notify, readBody, shapeTreatment } from "@/app/api/_lib/shape";

/**
 * GET /api/treatments — role-scoped. ?petId=&customerId=&providerId=
 * CUSTOMER → own pets' records; VET/GROOMER → own; STAFF/ADMIN → all + filters.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const where: Prisma.TreatmentWhereInput = {};

    if (user.role === "CUSTOMER") {
      where.pet = { ownerId: user.id };
    } else if (user.role === "VET" || user.role === "GROOMER") {
      where.providerId = user.id;
    } else {
      const customerId = url.searchParams.get("customerId");
      if (customerId) where.appointment = { customerId };
      const providerId = url.searchParams.get("providerId");
      if (providerId) where.providerId = providerId;
    }

    const petId = url.searchParams.get("petId");
    if (petId) where.petId = petId;

    const treatments = await db.treatment.findMany({
      where,
      include: TREATMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return json({ treatments: treatments.map(shapeTreatment) });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/treatments — VET/GROOMER/STAFF/ADMIN. Upsert by appointmentId; sets appointment COMPLETED. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, "VET", "GROOMER", "STAFF", "ADMIN");
    const body = await readBody(req);
    const appointmentId = asString(body.appointmentId);
    if (!appointmentId) throw new ApiError("appointmentId is required.", 400);

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { pet: true, service: true },
    });
    if (!appointment) throw new ApiError("Appointment not found.", 404);
    if ((user.role === "VET" || user.role === "GROOMER") && appointment.providerId !== user.id) {
      throw new ApiError("You can only add treatment records to your own appointments.", 403);
    }

    const data = {
      symptoms: asString(body.symptoms) ?? null,
      diagnosis: asString(body.diagnosis) ?? null,
      treatmentPlan: asString(body.treatmentPlan) ?? null,
      prescription: asString(body.prescription) ?? null,
      medication: asString(body.medication) ?? null,
      dosage: asString(body.dosage) ?? null,
      followUpDate: asString(body.followUpDate) ?? null,
      notes: asString(body.notes) ?? null,
    };

    const existing = await db.treatment.findUnique({ where: { appointmentId } });
    if (existing) {
      await db.treatment.update({ where: { id: existing.id }, data });
    } else {
      await db.treatment.create({
        data: {
          appointmentId,
          petId: appointment.petId,
          providerId: appointment.providerId,
          ...data,
        },
      });
    }

    if (appointment.status !== "COMPLETED") {
      await db.appointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } });
    }

    await notify(
      appointment.customerId,
      "Treatment record added",
      `A treatment record for ${appointment.pet.name} (${appointment.service.name}) was added. The appointment is now completed.`,
      "TREATMENT",
    );

    const treatment = await db.treatment.findUnique({ where: { appointmentId }, include: TREATMENT_INCLUDE });
    if (!treatment) throw new ApiError("Treatment could not be loaded.", 500);
    return json({ treatment: shapeTreatment(treatment) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
