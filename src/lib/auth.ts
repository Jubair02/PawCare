import { resolveSession } from "@/lib/session";
import { Prisma } from "@prisma/client";
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

/**
 * Classifies the deployment-level database failures that are otherwise
 * indistinguishable from an application bug.
 *
 * Both times login broke in production the cause was environmental — first the
 * `Session` table was missing (migrations never baselined), then the database
 * credentials were absent — yet every one of those requests returned the same
 * opaque "Something went wrong" 500. Naming the failure mode costs nothing and
 * turns a log-diving exercise into a single reading of `/api/health`.
 *
 * Returns null for ordinary application errors.
 */
export function describeDbFailure(e: unknown): { code: string; hint: string } | null {
  // Thrown when the client cannot start at all: DATABASE_URL missing, malformed
  // or unreachable. On Vercel this almost always means the environment variable
  // was never set, because `.env` is git-ignored and never leaves the machine.
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return {
      code: "DB_UNAVAILABLE",
      hint: process.env.DATABASE_URL
        ? "DATABASE_URL is set but the database could not be reached."
        : "DATABASE_URL is not set in this environment.",
    };
  }
  // P2021: table does not exist. P2022: column does not exist. Either means the
  // deployed schema is behind the code — migrations have not been applied.
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
    return {
      code: "DB_SCHEMA_OUTDATED",
      hint: "The database is reachable but missing a table or column this build expects. Run the migrations.",
    };
  }
  return null;
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) {
    return Response.json({ error: e.message }, { status: e.status });
  }

  const dbFailure = describeDbFailure(e);
  if (dbFailure) {
    // The hint names the misconfiguration for whoever reads the function logs;
    // the response body deliberately carries no connection details.
    console.error(`[api] ${dbFailure.code}: ${dbFailure.hint}`, e);
    return Response.json(
      {
        error: "The service is temporarily unavailable. Please try again in a moment.",
        code: dbFailure.code,
      },
      { status: 503 }
    );
  }

  console.error("[api]", e);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
