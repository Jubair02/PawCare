import { bearerToken, handleError, json } from "@/lib/auth";
import { revokeSession } from "@/lib/session";

/**
 * POST /api/auth/logout — destroys the caller's session server-side.
 *
 * Logging out used to only clear localStorage, which did nothing: the token was
 * the user's id and stayed valid forever. Now the session row is deleted, so a
 * copied token dies with it.
 *
 * Deliberately unauthenticated and always 200: an already-invalid token should
 * still let the client finish signing out, and this leaks nothing.
 */
export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (token) await revokeSession(token);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
