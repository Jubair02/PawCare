import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser, requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isValidSpecialtyForRole } from "@/lib/domain";
import { revokeAllSessions } from "@/lib/session";
import { MAX_LEN, ROLES, asBoolean, asBoundedString, asString, notify, readBody } from "@/app/api/_lib/shape";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/users/:id — ADMIN only. Also the account-recovery path (password reset). */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireRole(req, "ADMIN");
    const { id } = await ctx.params;
    const body = await readBody(req);

    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ApiError("User not found.", 404);

    const data: {
      name?: string;
      phone?: string;
      role?: string;
      specialty?: string;
      active?: boolean;
      bio?: string;
      password?: string;
    } = {};

    const name = asBoundedString(body.name, MAX_LEN.NAME, "Name");
    if (name !== undefined) {
      if (!name) throw new ApiError("Name cannot be empty.", 400);
      data.name = name;
    }
    const phone = asBoundedString(body.phone, MAX_LEN.PHONE, "Phone");
    if (phone !== undefined) data.phone = phone;
    const role = asString(body.role);
    if (role !== undefined) {
      if (!ROLES.includes(role)) throw new ApiError("Invalid role value.", 400);
      data.role = role;
    }
    const specialty = asBoundedString(body.specialty, MAX_LEN.SHORT, "Specialty");
    const effectiveRole = role ?? target.role;
    if (specialty !== undefined) {
      // Validate against the role being saved, not the stale one.
      if (!isValidSpecialtyForRole(effectiveRole, specialty)) {
        throw new ApiError(`A ${effectiveRole} cannot have the specialty "${specialty}".`, 400);
      }
      data.specialty = specialty;
    }
    // Demoting a VET/GROOMER to a non-provider role must not leave the old
    // specialty behind, whatever the client sent (or omitted).
    if (effectiveRole !== "VET" && effectiveRole !== "GROOMER") {
      data.specialty = "";
    }
    const active = asBoolean(body.active);
    if (active !== undefined) data.active = active;
    const bio = asBoundedString(body.bio, MAX_LEN.BIO, "Bio");
    if (bio !== undefined) data.bio = bio;

    // Account recovery: forgot-password is a stub with no mailer, so an admin
    // resetting the password is the supported way back into a locked-out account.
    const password = asBoundedString(body.password, MAX_LEN.PASSWORD, "Password");
    if (password !== undefined) {
      if (password.length < 6) throw new ApiError("Password must be at least 6 characters.", 400);
      data.password = await hashPassword(password);
    }

    // Lockout guards. DELETE already blocks self-deletion; without these an admin
    // could demote or deactivate themselves (or the last admin) and lock everyone out.
    const isSelf = target.id === admin.id;
    if (isSelf && role !== undefined && role !== target.role) {
      throw new ApiError("You cannot change your own role. Ask another admin to do it.", 400);
    }
    if (isSelf && active === false) {
      throw new ApiError("You cannot deactivate your own account.", 400);
    }

    const losesAdmin = (role !== undefined && role !== "ADMIN") || active === false;
    if (target.role === "ADMIN" && losesAdmin) {
      const otherAdmins = await db.user.count({
        where: { role: "ADMIN", active: true, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        throw new ApiError(
          "This is the last active admin account. Promote another admin before changing this one.",
          409,
        );
      }
    }

    const updated = await db.user.update({ where: { id }, data });

    // An admin reset, a demotion or a deactivation must invalidate the target's
    // existing sessions, otherwise the old token keeps working.
    if (data.password || data.role !== undefined || active === false) {
      await revokeAllSessions(updated.id);
    }

    if (data.password) {
      await notify(
        updated.id,
        "Password reset",
        "An administrator reset your password. If you did not request this, contact the clinic.",
        "SYSTEM",
      );
    }

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
