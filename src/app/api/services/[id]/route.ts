import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { MAX_LEN, SERVICE_CATEGORIES, asBoolean, asBoundedString, asNumber, asString, readBody, serviceRatings, shapeService } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/services/:id — ADMIN. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "ADMIN");
    const { id } = await ctx.params;
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Service not found.", 404);

    const body = await readBody(req);
    const data: {
      name?: string;
      category?: string;
      description?: string;
      duration?: number;
      price?: number;
      icon?: string;
      active?: boolean;
    } = {};

    const name = asBoundedString(body.name, MAX_LEN.NAME, "Service name");
    if (name !== undefined) {
      if (!name) throw new ApiError("Service name cannot be empty.", 400);
      data.name = name;
    }
    const category = asString(body.category);
    if (category !== undefined) {
      if (!SERVICE_CATEGORIES.includes(category)) {
        throw new ApiError("Category must be MEDICAL, GROOMING or DIAGNOSTIC.", 400);
      }
      data.category = category;
    }
    const description = asBoundedString(body.description, MAX_LEN.LONG, "Description");
    if (description !== undefined) data.description = description;
    const duration = asNumber(body.duration);
    if (duration !== undefined) {
      if (duration <= 0 || !Number.isInteger(duration)) {
        throw new ApiError("Duration must be a positive whole number of minutes.", 400);
      }
      data.duration = duration;
    }
    const price = asNumber(body.price);
    if (price !== undefined) {
      if (price < 0) throw new ApiError("Price must be a non-negative number.", 400);
      data.price = price;
    }
    const icon = asBoundedString(body.icon, MAX_LEN.SHORT, "Icon");
    if (icon !== undefined) data.icon = icon;
    const active = asBoolean(body.active);
    if (active !== undefined) data.active = active;

    await db.service.update({ where: { id }, data });
    const updated = await db.service.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!updated) throw new ApiError("Service could not be loaded.", 500);
    const ratings = await serviceRatings([id]);
    return json({ service: shapeService(updated, ratings.get(id)) });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/services/:id — ADMIN. Blocked when the service has appointments. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "ADMIN");
    const { id } = await ctx.params;
    const existing = await db.service.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!existing) throw new ApiError("Service not found.", 404);
    if (existing._count.appointments > 0) {
      throw new ApiError("This service has appointments and cannot be deleted. Deactivate it instead.", 409);
    }
    await db.service.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
