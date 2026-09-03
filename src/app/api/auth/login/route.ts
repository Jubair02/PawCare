import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { asString, readBody } from "@/app/api/_lib/shape";
import { MINUTE, clientIp, enforce, reset } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const email = asString(body.email)?.toLowerCase();
    const password = asString(body.password);

    if (!email || !password) throw new ApiError("Email and password are required.", 400);

    // Two limits: one stops a flood from a single source, the other stops a slow
    // distributed guess against one account. Neither existed before, so the login
    // endpoint accepted unlimited attempts against a fast password hash.
    const ip = clientIp(req);
    enforce(`login:ip:${ip}`, 20, 15 * MINUTE, "Too many login attempts from this device.");
    enforce(`login:email:${email}`, 10, 15 * MINUTE, "Too many login attempts for this account.");

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.password)) {
      throw new ApiError("Invalid email or password.", 401);
    }
    if (!user.active) {
      throw new ApiError("This account has been deactivated. Please contact support.", 403);
    }
    // Successful sign-in clears the counters so an honest user is never stuck.
    reset(`login:ip:${ip}`);
    reset(`login:email:${email}`);

    return json({ user: publicUser(user), token: user.id });
  } catch (e) {
    return handleError(e);
  }
}
