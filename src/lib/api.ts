import { useAppStore } from "./store";

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
}

/**
 * Fetch wrapper for the PawCare API.
 * - `path` is API-relative, e.g. "/api/pets" (no prefixing).
 * - Adds `Authorization: Bearer <token>` from the persisted zustand store.
 * - JSON-stringifies `body` when provided.
 * - Throws `Error(data.error || "Request failed")` on !ok responses.
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
