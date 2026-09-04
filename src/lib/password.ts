import { createHash, timingSafeEqual } from "crypto";

import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * Was: a single unsalted SHA-256 pass over a fixed global prefix. That is a
 * fast, GPU-friendly hash with no per-user salt, so one leak of the users table
 * meant every password was recoverable — and identical passwords produced
 * identical hashes, so cracking one cracked them all.
 *
 * Now: bcrypt at cost 12, which is salted per user and deliberately slow.
 * Legacy hashes are still *verifiable* so nobody is locked out, and any account
 * that logs in successfully is transparently upgraded (see `needsRehash`).
 */

const BCRYPT_COST = 12;

/** The old scheme, kept only to verify not-yet-migrated rows. */
const LEGACY_SALT = "pawcare::v1::";
const LEGACY_HASH_RE = /^[a-f0-9]{64}$/i;

function legacyHash(password: string): string {
  return createHash("sha256").update(LEGACY_SALT + password).digest("hex");
}

/** True when the stored value is an old unsalted SHA-256 digest. */
export function isLegacyHash(hash: string): boolean {
  return LEGACY_HASH_RE.test(hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export interface VerifyResult {
  /** Whether the password matched. */
  ok: boolean;
  /** True when it matched an old hash and the row should be re-hashed. */
  needsRehash: boolean;
}

/**
 * Verifies a password against either scheme.
 *
 * Always returns a result rather than throwing, and compares the legacy digest
 * in constant time so it cannot be probed by timing.
 */
export async function verifyPassword(password: string, hash: string): Promise<VerifyResult> {
  if (!hash) return { ok: false, needsRehash: false };

  if (isLegacyHash(hash)) {
    const expected = Buffer.from(legacyHash(password), "hex");
    const actual = Buffer.from(hash, "hex");
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    return { ok, needsRehash: ok };
  }

  try {
    return { ok: await bcrypt.compare(password, hash), needsRehash: false };
  } catch {
    // Malformed/unknown hash format — treat as a failed login, never a crash.
    return { ok: false, needsRehash: false };
  }
}
