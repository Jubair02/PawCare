import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { EMAIL_RE, asString, readBody } from "@/app/api/_lib/shape";
import { HOUR, clientIp, enforce } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    enforce(`register:ip:${clientIp(req)}`, 5, HOUR, "Too many accounts created from this device.");

    const body = await readBody(req);
    const name = asString(body.name);
    const email = asString(body.email)?.toLowerCase();
    const password = asString(body.password);
    const phone = asString(body.phone);

    if (!name) throw new ApiError("Name is required.", 400);
    if (!email || !EMAIL_RE.test(email)) throw new ApiError("A valid email is required.", 400);
    if (!password || password.length < 6) throw new ApiError("Password must be at least 6 characters.", 400);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new ApiError("An account with this email already exists.", 409);

    // Registration always creates a CUSTOMER account.
    const user = await db.user.create({
      data: { name, email, password: hashPassword(password), role: "CUSTOMER", phone: phone ?? null },
    });
    return json({ user: publicUser(user), token: user.id }, 201);
  } catch (e) {
    return handleError(e);
  }
}
