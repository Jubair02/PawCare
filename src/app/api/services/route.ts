import { db } from "@/lib/db";
import { ApiError, getAuthUser, handleError, json, requireRole } from "@/lib/auth";
import type { Service } from "@prisma/client";
import { SERVICE_CATEGORIES, asNumber, asString, readBody, serviceRatings, shapeService } from "@/app/api/_lib/shape";

/**
 * GET /api/services — public. ?active=true&category=
 * ADMIN callers get every service (incl. inactive) plus _count.appointments.
 * Everyone gets avg APPROVED-review `rating` (1 decimal) + `reviewCount`.
 */
export async function GET(req: Request) {
  try {
    const viewer = await getAuthUser(req);
    const isAdmin = viewer?.role === "ADMIN";
    const url = new URL(req.url);

    const where: { category?: string; active?: boolean } = {};
    const category = url.searchParams.get("category");
    if (category) where.category = category;

    const activeParam = url.searchParams.get("active");
    if (isAdmin) {
      // Admins manage the full catalogue — ignore the active filter.
    } else if (activeParam !== null) {
      where.active = activeParam === "true";
    } else {
      where.active = true; // public default: only active services
    }

    let services: Service[];
    if (isAdmin) {
      services = await db.service.findMany({
        where,
        include: { _count: { select: { appointments: true } } },
        orderBy: { name: "asc" },
      });
    } else {
      services = await db.service.findMany({ where, orderBy: { name: "asc" } });
    }

    const ratings = await serviceRatings(services.map((s) => s.id));
    const shaped = services.map((s) =>
      shapeService(s as Service & { _count?: { appointments: number } }, ratings.get(s.id)),
    );
    return json({ services: shaped });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/services — ADMIN. */
export async function POST(req: Request) {
  try {
    await requireRole(req, "ADMIN");
    const body = await readBody(req);
    const name = asString(body.name);
    const category = asString(body.category);
    const description = asString(body.description);
    const duration = asNumber(body.duration);
    const price = asNumber(body.price);
    const icon = asString(body.icon);
    const active = body.active === undefined ? true : body.active === true || body.active === "true";

    if (!name) throw new ApiError("Service name is required.", 400);
    if (!category || !SERVICE_CATEGORIES.includes(category)) {
      throw new ApiError("Category must be MEDICAL, GROOMING or DIAGNOSTIC.", 400);
    }
    if (description === undefined) throw new ApiError("Description is required.", 400);
    if (duration === undefined || duration <= 0 || !Number.isInteger(duration)) {
      throw new ApiError("Duration must be a positive whole number of minutes.", 400);
    }
    if (price === undefined || price < 0) throw new ApiError("Price must be a non-negative number.", 400);

    const service = await db.service.create({
      data: { name, category, description, duration, price, icon: icon ?? "🐾", active },
    });
    return json({ service: shapeService(service) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
