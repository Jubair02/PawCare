import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { MAX_LEN, asBoundedString, asString, readBody } from "@/app/api/_lib/shape";
import { MINUTE, clientIp, enforce, reset } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const email = asBoundedString(body.email, MAX_LEN.EMAIL, "Email")?.toLowerCase();
    const password = asBoundedString(body.password, MAX_LEN.PASSWORD, "Password");

    if (!email || !password) throw new ApiError("Email and password are required.", 400);

    // Two limits: one stops a flood from a single source, the other stops a slow
    // distributed guess against one account. Neither existed before, so the login
    // endpoint accepted unlimited attempts against a fast password hash.
    const ip = clientIp(req);
    enforce(`login:ip:${ip}`, 20, 15 * MINUTE, "Too many login attempts from this device.");
    enforce(`login:email:${email}`, 10, 15 * MINUTE, "Too many login attempts for this account.");

    const user = await db.user.findUnique({ where: { email } });
    // Always run a verification so a missing account and a wrong password take
    // comparable time and cannot be told apart by timing.
    const result = user
      ? await verifyPassword(password, user.password)
      : { ok: false, needsRehash: false };

    if (!user || !result.ok) {
      throw new ApiError("Invalid email or password.", 401);
    }
    if (!user.active) {
      throw new ApiError("This account has been deactivated. Please contact support.", 403);
    }
    // Silently migrate a legacy SHA-256 hash now that we know the plaintext.
    if (result.needsRehash) {
      await db.user
        .update({ where: { id: user.id }, data: { password: await hashPassword(password) } })
        .catch(() => undefined);
    }

    // Successful sign-in clears the counters so an honest user is never stuck.
    reset(`login:ip:${ip}`);
    reset(`login:email:${email}`);

    const session = await createSession(user.id, req.headers.get("user-agent"));
    return json({
      user: publicUser(user),
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}
