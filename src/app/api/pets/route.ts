import { db } from "@/lib/db";
import { ApiError, handleError, json, requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { MAX_LEN, PET_GENDERS, PET_TYPES, VACCINATION_STATUSES, asBoundedString, asNumber, asString, assertValidPhoto, pageMeta, readBody, readPage, shapePet } from "@/app/api/_lib/shape";

/**
 * GET /api/pets — role-scoped.
 * CUSTOMER → own pets; ADMIN/STAFF → all (+ ?ownerId=&q=); VET/GROOMER → pets having appointments with them.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const where: Prisma.PetWhereInput = {};

    if (user.role === "CUSTOMER") {
      where.ownerId = user.id;
    } else if (user.role === "VET" || user.role === "GROOMER") {
      where.appointments = { some: { providerId: user.id } };
    } else {
      const ownerId = url.searchParams.get("ownerId");
      if (ownerId) where.ownerId = ownerId;
    }

    const q = url.searchParams.get("q");
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { breed: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
      ];
    }

    const page = readPage(url);
    const [pets, total] = await Promise.all([
      db.pet.findMany({
        where,
        include: { owner: true, _count: { select: { appointments: true } } },
        orderBy: { createdAt: "desc" },
        ...page,
      }),
      db.pet.count({ where }),
    ]);
    return json({ pets: pets.map(shapePet), page: pageMeta(total, page) });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/pets — CUSTOMER creates their own pet; STAFF/ADMIN register one for
 * a customer via `ownerId`.
 *
 * The front desk needs this to take a walk-in: previously only the customer
 * could add a pet, so a staff booking dead-ended for anyone whose pet was not
 * already on file.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const onBehalf = user.role === "STAFF" || user.role === "ADMIN";
    if (user.role !== "CUSTOMER" && !onBehalf) {
      throw new ApiError("Only customers, staff and admins can register pets.", 403);
    }
    const body = await readBody(req);

    // Whose pet this is: the caller's own, or the customer a staff member names.
    let ownerId = user.id;
    if (onBehalf) {
      const requested = asString(body.ownerId);
      if (!requested) throw new ApiError("ownerId is required when registering a pet for a customer.", 400);
      const owner = await db.user.findUnique({ where: { id: requested } });
      if (!owner || !owner.active) throw new ApiError("Customer not found.", 404);
      if (owner.role !== "CUSTOMER") throw new ApiError("Pets can only be registered to customer accounts.", 400);
      ownerId = owner.id;
    }

    const name = asBoundedString(body.name, MAX_LEN.NAME, "Pet name");
    const type = asString(body.type);
    const breed = asBoundedString(body.breed, MAX_LEN.SHORT, "Breed");
    const gender = asString(body.gender);
    const birthDate = asBoundedString(body.birthDate, MAX_LEN.SHORT, "Birth date");
    const weight = asNumber(body.weight);
    const color = asBoundedString(body.color, MAX_LEN.SHORT, "Colour");
    const photo = asString(body.photo);
    const medicalNotes = asBoundedString(body.medicalNotes, MAX_LEN.LONG, "Medical notes");
    const vaccinationStatus = asString(body.vaccinationStatus);

    if (!name) throw new ApiError("Pet name is required.", 400);
    if (!type || !PET_TYPES.includes(type)) throw new ApiError("Pet type must be DOG, CAT, BIRD or OTHER.", 400);
    if (gender !== undefined && !PET_GENDERS.includes(gender)) throw new ApiError("Gender must be MALE or FEMALE.", 400);
    if (vaccinationStatus !== undefined && !VACCINATION_STATUSES.includes(vaccinationStatus)) {
      throw new ApiError("Vaccination status must be UP_TO_DATE, PARTIAL or NONE.", 400);
    }
    if (weight !== undefined && weight <= 0) throw new ApiError("Weight must be a positive number.", 400);
    if (photo !== undefined) assertValidPhoto(photo);

    const created = await db.pet.create({
      data: {
        name,
        type,
        ownerId,
        ...(breed !== undefined ? { breed } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(weight !== undefined ? { weight } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(photo !== undefined ? { photo } : {}),
        ...(medicalNotes !== undefined ? { medicalNotes } : {}),
        ...(vaccinationStatus !== undefined ? { vaccinationStatus } : {}),
      },
    });

    const pet = await db.pet.findUnique({
      where: { id: created.id },
      include: { owner: true, _count: { select: { appointments: true } } },
    });
    if (!pet) throw new ApiError("Pet could not be loaded.", 500);
    return json({ pet: shapePet(pet) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
