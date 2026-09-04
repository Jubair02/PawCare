import { db } from "@/lib/db";
import { ApiError, handleError, json, requireUser } from "@/lib/auth";
import { APPOINTMENT_INCLUDE, MAX_LEN, PET_GENDERS, PET_TYPES, TREATMENT_INCLUDE, VACCINATION_STATUSES, asBoundedString, asNumber, asString, assertValidPhoto, readBody, shapeAppointment, shapePet, shapeTreatment } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/pets/:id — owner, ADMIN/STAFF, or a provider with an appointment for the pet. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const pet = await db.pet.findUnique({
      where: { id },
      include: { owner: true, _count: { select: { appointments: true } } },
    });
    if (!pet) throw new ApiError("Pet not found.", 404);

    let allowed = user.role === "ADMIN" || user.role === "STAFF" || pet.ownerId === user.id;
    if (!allowed && (user.role === "VET" || user.role === "GROOMER")) {
      const linked = await db.appointment.findFirst({ where: { petId: id, providerId: user.id }, select: { id: true } });
      allowed = linked !== null;
    }
    if (!allowed) throw new ApiError("You don't have access to this pet.", 403);

    const [appointments, treatments] = await Promise.all([
      db.appointment.findMany({
        where: { petId: id },
        include: APPOINTMENT_INCLUDE,
        orderBy: [{ date: "desc" }, { time: "desc" }],
      }),
      db.treatment.findMany({
        where: { petId: id },
        include: TREATMENT_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return json({
      pet: {
        ...shapePet(pet),
        appointments: appointments.map(shapeAppointment),
        treatments: treatments.map(shapeTreatment),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/pets/:id — owner or ADMIN. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const pet = await db.pet.findUnique({ where: { id } });
    if (!pet) throw new ApiError("Pet not found.", 404);
    if (pet.ownerId !== user.id && user.role !== "ADMIN") {
      throw new ApiError("You don't have permission to edit this pet.", 403);
    }

    const body = await readBody(req);
    const data: Record<string, string | number | null> = {};

    const name = asBoundedString(body.name, MAX_LEN.NAME, "Pet name");
    if (name !== undefined) {
      if (!name) throw new ApiError("Pet name cannot be empty.", 400);
      data.name = name;
    }
    const type = asString(body.type);
    if (type !== undefined) {
      if (!PET_TYPES.includes(type)) throw new ApiError("Pet type must be DOG, CAT, BIRD or OTHER.", 400);
      data.type = type;
    }
    const breed = asBoundedString(body.breed, MAX_LEN.SHORT, "Breed");
    if (breed !== undefined) data.breed = breed;
    const gender = asString(body.gender);
    if (gender !== undefined) {
      if (!PET_GENDERS.includes(gender)) throw new ApiError("Gender must be MALE or FEMALE.", 400);
      data.gender = gender;
    }
    const birthDate = asBoundedString(body.birthDate, MAX_LEN.SHORT, "Birth date");
    if (birthDate !== undefined) data.birthDate = birthDate;
    // Explicit null (or "") clears the weight; there was previously no way to
    // unset it once recorded.
    if (body.weight === null || body.weight === "") {
      data.weight = null;
    } else {
      const weight = asNumber(body.weight);
      if (weight !== undefined) {
        if (weight <= 0) throw new ApiError("Weight must be a positive number.", 400);
        data.weight = weight;
      }
    }
    const color = asBoundedString(body.color, MAX_LEN.SHORT, "Colour");
    if (color !== undefined) data.color = color;
    const photo = asString(body.photo);
    if (photo !== undefined) {
      assertValidPhoto(photo);
      data.photo = photo;
    }
    const medicalNotes = asBoundedString(body.medicalNotes, MAX_LEN.LONG, "Medical notes");
    if (medicalNotes !== undefined) data.medicalNotes = medicalNotes;
    const vaccinationStatus = asString(body.vaccinationStatus);
    if (vaccinationStatus !== undefined) {
      if (!VACCINATION_STATUSES.includes(vaccinationStatus)) {
        throw new ApiError("Vaccination status must be UP_TO_DATE, PARTIAL or NONE.", 400);
      }
      data.vaccinationStatus = vaccinationStatus;
    }

    const updated = await db.pet.update({
      where: { id },
      data,
      include: { owner: true, _count: { select: { appointments: true } } },
    });
    return json({ pet: shapePet(updated) });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/pets/:id — owner or ADMIN. Blocked when the pet has appointments. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const pet = await db.pet.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!pet) throw new ApiError("Pet not found.", 404);
    if (pet.ownerId !== user.id && user.role !== "ADMIN") {
      throw new ApiError("You don't have permission to delete this pet.", 403);
    }
    if (pet._count.appointments > 0) {
      throw new ApiError("This pet has appointments and cannot be deleted.", 409);
    }

    await db.review.updateMany({ where: { petId: id }, data: { petId: null } });
    await db.pet.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
