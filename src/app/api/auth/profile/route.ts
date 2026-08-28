import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser, requireUser } from "@/lib/auth";
import { asString, readBody } from "@/app/api/_lib/shape";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);

    const data: { name?: string; phone?: string; bio?: string; specialty?: string } = {};
    const name = asString(body.name);
    if (name !== undefined) {
      if (!name) throw new ApiError("Name cannot be empty.", 400);
      data.name = name;
    }
    const phone = asString(body.phone);
    if (phone !== undefined) data.phone = phone;
    const bio = asString(body.bio);
    if (bio !== undefined) data.bio = bio;
    const specialty = asString(body.specialty);
    if (specialty !== undefined) data.specialty = specialty;

    const updated = await db.user.update({ where: { id: user.id }, data });
    return json({ user: publicUser(updated) });
  } catch (e) {
    return handleError(e);
  }
}
