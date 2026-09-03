import { db } from "@/lib/db";
import { ApiError, getAuthUser, handleError, json, requireRole } from "@/lib/auth";
import { REVIEW_INCLUDE, asString, pageMeta, readBody, readPage, shapeReview } from "@/app/api/_lib/shape";

/**
 * GET /api/reviews — public default APPROVED.
 * ?status=PENDING|HIDDEN|ALL requires ADMIN (or mine=true scoping to own reviews).
 * ?serviceId=&providerId=&mine=true
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const viewer = await getAuthUser(req);
    const mine = url.searchParams.get("mine") === "true";
    if (mine && !viewer) throw new ApiError("Authentication required. Please log in.", 401);

    const statusParam = url.searchParams.get("status");
    const status = statusParam ?? (mine ? "ALL" : "APPROVED");

    if (status === "PENDING" || status === "HIDDEN" || status === "ALL") {
      if (!viewer) throw new ApiError("Authentication required. Please log in.", 401);
      if (viewer.role !== "ADMIN" && !mine) {
        throw new ApiError("You don't have permission to view these reviews.", 403);
      }
    }

    const where: {
      customerId?: string;
      status?: string;
      serviceId?: string;
      providerId?: string;
    } = {};
    if (mine && viewer) where.customerId = viewer.id;
    if (status !== "ALL") where.status = status;
    const serviceId = url.searchParams.get("serviceId");
    if (serviceId) where.serviceId = serviceId;
    const providerId = url.searchParams.get("providerId");
    if (providerId) where.providerId = providerId;

    const page = readPage(url);
    const [reviews, total] = await Promise.all([
      db.review.findMany({ where, include: REVIEW_INCLUDE, orderBy: { createdAt: "desc" }, ...page }),
      db.review.count({ where }),
    ]);
    return json({ reviews: reviews.map(shapeReview), page: pageMeta(total, page) });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/reviews — CUSTOMER reviews their own COMPLETED appointment. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(req, "CUSTOMER");
    const body = await readBody(req);
    const appointmentId = asString(body.appointmentId);
    const comment = asString(body.comment);
    const rating = typeof body.rating === "number" ? body.rating : typeof body.rating === "string" && body.rating.trim() !== "" ? Number(body.rating) : NaN;

    if (!appointmentId) throw new ApiError("appointmentId is required.", 400);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError("Rating must be an integer between 1 and 5.", 400);
    }

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { review: true },
    });
    if (!appointment) throw new ApiError("Appointment not found.", 404);
    if (appointment.customerId !== user.id) {
      throw new ApiError("You can only review your own appointments.", 403);
    }
    if (appointment.status !== "COMPLETED") {
      throw new ApiError("You can only review completed appointments.", 400);
    }
    if (appointment.review) {
      throw new ApiError("You have already reviewed this appointment.", 409);
    }

    await db.review.create({
      data: {
        appointmentId,
        customerId: user.id,
        petId: appointment.petId,
        serviceId: appointment.serviceId,
        providerId: appointment.providerId,
        rating,
        comment: comment ?? null,
        status: "PENDING",
      },
    });

    const full = await db.review.findUnique({ where: { appointmentId }, include: REVIEW_INCLUDE });
    if (!full) throw new ApiError("Review could not be loaded.", 500);
    return json({ review: shapeReview(full) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
