import { resolveSession } from "@/lib/session";
import type { User } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Extracts the raw bearer token, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token === "" ? null : token;
}

/**
 * Resolves the caller from their session token.
 *
 * This used to look the token up as a *user id*, so any id leaked by a public
 * endpoint authenticated as that user permanently. Tokens are now random,
 * expiring session handles that can be revoked.
 */
export async function getAuthUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  return resolveSession(token);
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
