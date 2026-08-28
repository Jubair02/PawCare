import { db } from "@/lib/db";
import type { User } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Reads `Authorization: Bearer <userId>` header (demo-grade token = user id). */
export async function getAuthUser(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const user = await db.user.findUnique({ where: { id: token } });
  return user && user.active ? user : null;
}

export async function requireUser(req: Request): Promise<User> {
  const user = await getAuthUser(req);
  if (!user) throw new ApiError("Authentication required. Please log in.", 401);
  return user;
}

export async function requireRole(req: Request, ...roles: string[]): Promise<User> {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) {
    throw new ApiError("You don't have permission to perform this action.", 403);
  }
  return user;
}

export function publicUser(u: User) {
  const { password, ...rest } = u;
  return rest;
}

export function json(data: unknown, status = 200) {
  return Response.json(data as Record<string, unknown>, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[api]", e);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
