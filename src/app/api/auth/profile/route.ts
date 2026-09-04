import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser, requireUser } from "@/lib/auth";
import { MAX_LEN, asBoundedString, asString, readBody } from "@/app/api/_lib/shape";
import { isValidSpecialtyForRole } from "@/lib/domain";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);

    const data: { name?: string; phone?: string; bio?: string; specialty?: string } = {};
    const name = asBoundedString(body.name, MAX_LEN.NAME, "Name");
    if (name !== undefined) {
      if (!name) throw new ApiError("Name cannot be empty.", 400);
      data.name = name;
    }
    const phone = asBoundedString(body.phone, MAX_LEN.PHONE, "Phone");
    if (phone !== undefined) data.phone = phone;
    const bio = asBoundedString(body.bio, MAX_LEN.BIO, "Bio");
    if (bio !== undefined) data.bio = bio;
    const specialty = asBoundedString(body.specialty, MAX_LEN.SHORT, "Specialty");
    if (specialty !== undefined) {
      if (!isValidSpecialtyForRole(user.role, specialty)) {
        throw new ApiError(
          "Your specialty is set by your role and cannot be changed here. Contact an administrator.",
          400,
        );
      }
      data.specialty = specialty;
    }

    const updated = await db.user.update({ where: { id: user.id }, data });
    return json({ user: publicUser(updated) });
  } catch (e) {
    return handleError(e);
  }
}
