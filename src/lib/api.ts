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
    throw new Error(err.error || "Request failed");
  }

  return data as T;
}
