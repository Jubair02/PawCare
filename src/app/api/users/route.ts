import { db } from "@/lib/db";
import { ApiError, handleError, json, publicUser, requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import type { Prisma } from "@prisma/client";
import { EMAIL_RE, ROLES, asBoolean, asString, pageMeta, readBody, readPage } from "@/app/api/_lib/shape";

/** GET /api/users — ADMIN/STAFF only. ?role=&q=&active= */
export async function GET(req: Request) {
  try {
    await requireRole(req, "ADMIN", "STAFF");
    const url = new URL(req.url);
    const where: Prisma.UserWhereInput = {};

    const role = url.searchParams.get("role");
    if (role) where.role = role;

    const q = url.searchParams.get("q");
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const active = asBoolean(url.searchParams.get("active"));
    if (active !== undefined) where.active = active;

    const page = readPage(url);
    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: { _count: { select: { pets: true, customerAppointments: true } } },
        orderBy: { createdAt: "desc" },
        ...page,
      }),
      db.user.count({ where }),
    ]);
    return json({
      users: users.map((u) => ({ ...publicUser(u), _count: u._count })),
      page: pageMeta(total, page),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/users — ADMIN creates any staff/provider/customer account. */
export async function POST(req: Request) {
  try {
    await requireRole(req, "ADMIN");
    const body = await readBody(req);
    const name = asString(body.name);
    const email = asString(body.email)?.toLowerCase();
    const password = asString(body.password);
    const role = asString(body.role);
    const phone = asString(body.phone);
    const specialty = asString(body.specialty);

    if (!name) throw new ApiError("Name is required.", 400);
    if (!email || !EMAIL_RE.test(email)) throw new ApiError("A valid email is required.", 400);
    if (!password || password.length < 6) throw new ApiError("Password must be at least 6 characters.", 400);
    if (!role || !ROLES.includes(role)) throw new ApiError("Role must be one of ADMIN, STAFF, VET, GROOMER, CUSTOMER.", 400);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new ApiError("An account with this email already exists.", 409);

    const user = await db.user.create({
      data: { name, email, password: hashPassword(password), role, phone: phone ?? null, specialty: specialty ?? null },
    });
    return json({ user: publicUser(user) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
