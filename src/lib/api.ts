import { useAppStore } from "./store";

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  /** Abort signal. Rejects with an AbortError — test it with `isAbortError`. */
  signal?: AbortSignal;
}

/**
 * Fetch wrapper for the PawCare API.
 * - `path` is API-relative, e.g. "/api/pets" (no prefixing).
 * - Adds `Authorization: Bearer <token>` from the persisted zustand store.
 * - JSON-stringifies `body` when provided.
 * - Throws `Error(data.error || "Request failed")` on !ok responses.
 * - Forwards `signal`, so a superseded request can be abandoned.
 * - Clears the persisted session on a 401 so a dead token cannot loop forever.
 */
export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const token = useAppStore.getState().token;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: options?.signal,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // response had no JSON body
  }

  if (!res.ok) {
    const err = (data ?? {}) as { error?: string };

    // A 401 while we were holding a token means the session is gone (account
    // deactivated, database reseeded, access revoked). Without this the persisted
    // store keeps the user "logged in" and every view just toasts errors forever.
    if (res.status === 401 && token) {
      useAppStore.getState().logout();
      throw new Error(err.error || "Your session has expired. Please log in again.");
    }

    throw new Error(err.error || "Request failed");
  }

  return data as T;
}

/**
 * True when a rejection came from an aborted request rather than a real failure.
 *
 * A cancelled fetch is an expected outcome — the caller moved on — so it must
 * not toast an error or clobber state the newer request is about to fill.
 *
 * WHEN A VIEW NEEDS AN ABORT GUARD
 *
 * The test is whether a *server-side* parameter drives the refetch, not simply
 * whether the component fetches. A guard earns its keep only where request N
 * can still be in flight when request N+1 is issued, so a stale response can
 * land last and overwrite fresher data.
 *
 * Needs one: a debounced `?q=` search, a status/date filter passed to the API,
 * an availability lookup keyed on the chosen date. Any list whose `load()`
 * takes arguments that change as the user types or picks.
 *
 * Does not: a `[]`-dependency `load()` called on mount and after mutations,
 * whose filtering happens client-side over the already-loaded list. There is no
 * superseded-response window to protect, and adding a controller there is dead
 * code that reads like a fix. A manual Refresh button is also fine unguarded —
 * nothing supersedes it.
 *
 * This distinction has already produced one false-positive "missing guard"
 * report, so it is written down rather than re-derived.
 */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : (e as Error | null)?.name === "AbortError";
}

/**
 * Message from a thrown error, for `toast.error(...)`.
 *
 * `apiFetch` rejects with `Error(data.error)`, so this is the standard way to
 * surface a server message. Replaces ten identical local `errMsg` copies.
 */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
