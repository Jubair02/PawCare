import { db } from "@/lib/db";
import { ApiError, handleError, json, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { asString, readBody } from "@/app/api/_lib/shape";
import { HOUR, enforce } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    // Guards the current-password check against being used as an oracle.
    enforce(`change-password:${user.id}`, 10, HOUR, "Too many password change attempts.");

    const body = await readBody(req);
    const currentPassword = asString(body.currentPassword);
    const newPassword = asString(body.newPassword);

    if (!currentPassword || !newPassword) {
      throw new ApiError("Current and new password are required.", 400);
    }
    if (newPassword.length < 6) {
      throw new ApiError("New password must be at least 6 characters.", 400);
    }
    if (!verifyPassword(currentPassword, user.password)) {
      throw new ApiError("Current password is incorrect.", 400);
    }
    await db.user.update({ where: { id: user.id }, data: { password: hashPassword(newPassword) } });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
