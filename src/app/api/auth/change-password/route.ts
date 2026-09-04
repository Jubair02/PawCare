import { db } from "@/lib/db";
import { ApiError, bearerToken, handleError, json, requireUser } from "@/lib/auth";
import { revokeAllSessions } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MAX_LEN, asBoundedString, asString, readBody } from "@/app/api/_lib/shape";
import { HOUR, enforce } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    // Guards the current-password check against being used as an oracle.
    enforce(`change-password:${user.id}`, 10, HOUR, "Too many password change attempts.");

    const body = await readBody(req);
    const currentPassword = asBoundedString(body.currentPassword, MAX_LEN.PASSWORD, "Current password");
    const newPassword = asBoundedString(body.newPassword, MAX_LEN.PASSWORD, "New password");

    if (!currentPassword || !newPassword) {
      throw new ApiError("Current and new password are required.", 400);
    }
    if (newPassword.length < 6) {
      throw new ApiError("New password must be at least 6 characters.", 400);
    }
    const result = await verifyPassword(currentPassword, user.password);
    if (!result.ok) {
      throw new ApiError("Current password is incorrect.", 400);
    }

    await db.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
    });

    // Changing a password must end any session an attacker still holds, while
    // keeping the caller signed in on this device.
    const revoked = await revokeAllSessions(user.id, bearerToken(req) ?? undefined);
    return json({ ok: true, signedOutOtherDevices: revoked });
  } catch (e) {
    return handleError(e);
  }
}
