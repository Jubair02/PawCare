import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { REVIEW_INCLUDE, REVIEW_STATUSES, asString, readBody, shapeReview } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/reviews/:id — ADMIN moderates review status. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "ADMIN");
    const { id } = await ctx.params;

    const review = await db.review.findUnique({ where: { id } });
    if (!review) throw new ApiError("Review not found.", 404);

    const body = await readBody(req);
    const status = asString(body.status);
    if (!status || !REVIEW_STATUSES.includes(status)) {
      throw new ApiError("Status must be PENDING, APPROVED or HIDDEN.", 400);
    }

    await db.review.update({ where: { id }, data: { status } });
    const full = await db.review.findUnique({ where: { id }, include: REVIEW_INCLUDE });
    if (!full) throw new ApiError("Review could not be loaded.", 500);
    return json({ review: shapeReview(full) });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/reviews/:id — ADMIN. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "ADMIN");
    const { id } = await ctx.params;

    const review = await db.review.findUnique({ where: { id } });
    if (!review) throw new ApiError("Review not found.", 404);

    await db.review.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
