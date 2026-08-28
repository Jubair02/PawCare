import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser, requireRole } from "@/lib/auth";
import { ROLES, asBoolean, asString, readBody } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/users/:id — ADMIN only. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireRole(req, "ADMIN");
    const { id } = await ctx.params;
    const body = await readBody(req);

    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ApiError("User not found.", 404);

    const data: { name?: string; phone?: string; role?: string; specialty?: string; active?: boolean; bio?: string } = {};

    const name = asString(body.name);
    if (name !== undefined) {
      if (!name) throw new ApiError("Name cannot be empty.", 400);
      data.name = name;
    }
    const phone = asString(body.phone);
    if (phone !== undefined) data.phone = phone;
    const role = asString(body.role);
    if (role !== undefined) {
      if (!ROLES.includes(role)) throw new ApiError("Invalid role value.", 400);
      data.role = role;
    }
    const specialty = asString(body.specialty);
    if (specialty !== undefined) data.specialty = specialty;
    const active = asBoolean(body.active);
    if (active !== undefined) data.active = active;
    const bio = asString(body.bio);
    if (bio !== undefined) data.bio = bio;

    const updated = await db.user.update({ where: { id }, data });
    return json({ user: publicUser(updated) });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/users/:id — ADMIN only. Blocks self-delete, admin-delete and users with data. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireRole(req, "ADMIN");
    const { id } = await ctx.params;

    if (id === admin.id) throw new ApiError("You cannot delete your own account.", 400);

    const target = await db.user.findUnique({
      where: { id },
      include: { _count: { select: { pets: true, customerAppointments: true, providerAppointments: true, treatments: true } } },
    });
    if (!target) throw new ApiError("User not found.", 404);
    if (target.role === "ADMIN") throw new ApiError("Admin accounts cannot be deleted.", 400);

    const c = target._count;
    if (c.pets > 0 || c.customerAppointments > 0 || c.providerAppointments > 0 || c.treatments > 0) {
      throw new ApiError("This user has pets or appointments and cannot be deleted. Deactivate the account instead.", 409);
    }

    await db.notification.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
