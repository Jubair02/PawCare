import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole, requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { DATE_RE, MAX_LEN, TREATMENT_INCLUDE, asBoundedString, asString, notify, pageMeta, readBody, readPage, shapeTreatment } from "@/app/api/_lib/shape";

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

    const page = readPage(url);
    const [treatments, total] = await Promise.all([
      db.treatment.findMany({ where, include: TREATMENT_INCLUDE, orderBy: { createdAt: "desc" }, ...page }),
      db.treatment.count({ where }),
    ]);
    return json({ treatments: treatments.map(shapeTreatment), page: pageMeta(total, page) });
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

    // Respect the appointment state machine: a record belongs to a visit that is
    // actually happening (IN_PROGRESS -> COMPLETED) or already finished (an edit).
    // Previously this forced any status, including CANCELLED, straight to COMPLETED.
    if (appointment.status !== "IN_PROGRESS" && appointment.status !== "COMPLETED") {
      throw new ApiError(
        `A treatment record can only be added once the appointment is in progress. This one is ${appointment.status
          .replace(/_/g, " ")
          .toLowerCase()}.`,
        409,
      );
    }

    const FIELDS = [
      "symptoms",
      "diagnosis",
      "treatmentPlan",
      "prescription",
      "medication",
      "dosage",
      "followUpDate",
      "notes",
    ] as const;

    // Only touch fields the caller actually sent. This used to overwrite the whole
    // row every time, so editing one field silently erased every other one.
    // Sending an explicit empty string still clears a field.
    const incoming: Partial<Record<(typeof FIELDS)[number], string | null>> = {};
    for (const key of FIELDS) {
      if (key in body) incoming[key] = asBoundedString(body[key], MAX_LEN.LONG, key) || null;
    }

    const existing = await db.treatment.findUnique({ where: { appointmentId } });

    // Validate the result of the edit, not just the patch — amending the notes on
    // a record that already has a diagnosis must not be rejected.
    const merged = {
      symptoms: existing?.symptoms ?? null,
      diagnosis: existing?.diagnosis ?? null,
      treatmentPlan: existing?.treatmentPlan ?? null,
      prescription: existing?.prescription ?? null,
      medication: existing?.medication ?? null,
      dosage: existing?.dosage ?? null,
      followUpDate: existing?.followUpDate ?? null,
      notes: existing?.notes ?? null,
      ...incoming,
    };

    if (!merged.diagnosis && !merged.treatmentPlan) {
      throw new ApiError("A diagnosis or a treatment plan is required.", 400);
    }
    if (merged.followUpDate && !DATE_RE.test(merged.followUpDate)) {
      throw new ApiError("Follow-up date must be in yyyy-MM-dd format.", 400);
    }

    const data = merged;
    if (existing) {
      await db.treatment.update({ where: { id: existing.id }, data: incoming });
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

    // Completing the visit is now an explicit, separate decision. Saving a record
    // used to close the appointment as a side effect, with no way to save a
    // work-in-progress note.
    const complete = body.complete === true;
    const completedNow = complete && appointment.status !== "COMPLETED";
    if (completedNow) {
      await db.appointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } });
    }

    await notify(
      appointment.customerId,
      existing ? "Treatment record updated" : "Treatment record added",
      `The treatment record for ${appointment.pet.name} (${appointment.service.name}) was ${
        existing ? "updated" : "added"
      }.${completedNow ? " The appointment is now completed." : ""}`,
      "TREATMENT",
    );

    const treatment = await db.treatment.findUnique({ where: { appointmentId }, include: TREATMENT_INCLUDE });
    if (!treatment) throw new ApiError("Treatment could not be loaded.", 500);
    return json({ treatment: shapeTreatment(treatment) }, existing ? 200 : 201);
  } catch (e) {
    return handleError(e);
  }
}
