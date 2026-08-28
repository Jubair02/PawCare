import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { asString, readBody } from "@/app/api/_lib/shape";

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const email = asString(body.email)?.toLowerCase();
    const password = asString(body.password);

    if (!email || !password) throw new ApiError("Email and password are required.", 400);

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.password)) {
      throw new ApiError("Invalid email or password.", 401);
    }
    if (!user.active) {
      throw new ApiError("This account has been deactivated. Please contact support.", 403);
    }
    return json({ user: publicUser(user), token: user.id });
  } catch (e) {
    return handleError(e);
  }
}
