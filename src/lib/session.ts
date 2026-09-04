import { createHash, randomBytes, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";

/**
 * Opaque, expiring, revocable session tokens.
 *
 * The previous scheme used the user's database id as the bearer token. Those
 * ids are returned by public endpoints (`/api/providers`, `/api/reviews`), so
 * anyone could read an id and authenticate as that user, forever, with no way
 * to revoke it.
 *
 * A token here is 32 random bytes. Only its SHA-256 is stored, so a dump of the
 * sessions table cannot be replayed. Hashing (not bcrypt) is correct for this:
 * the input is already high-entropy, so speed is not a weakness, and lookups
 * must be indexable.
 */

/** Absolute lifetime. Sessions do not slide past this. */
export const SESSION_TTL_DAYS = 30;

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

/** Creates a session and returns the raw token — the only time it exists in plaintext. */
export async function createSession(userId: string, userAgent?: string | null): Promise<IssuedSession> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiresAt };
}

/**
 * Resolves a raw token to its user, or null.
 *
 * Returns null for unknown, expired, or deactivated-user sessions, and deletes
 * an expired row as it goes so the table self-prunes on use.
 */
export async function resolveSession(token: string) {
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // A deactivated account must lose access immediately, not at expiry.
  if (!session.user.active) return null;

  // Cheap activity tracking; skipped when it would write on every request.
  const sinceTouch = Date.now() - session.lastUsedAt.getTime();
  if (sinceTouch > 60 * 60 * 1000) {
    await db.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return session.user;
}

/** Ends one session (logout). */
export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * Ends every session for a user — used on password change and when an admin
 * deactivates or resets an account, so a stolen token cannot outlive the event.
 * Pass `exceptToken` to keep the caller signed in.
 */
export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: {
      userId,
      ...(exceptToken ? { tokenHash: { not: hashToken(exceptToken) } } : {}),
    },
  });
  return count;
}

/** Deletes expired rows. Safe to call from a cron or on demand. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}

/** Constant-time compare for any place that comps two tokens directly. */
export function tokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
