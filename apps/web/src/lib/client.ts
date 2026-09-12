/** Tiny fetch wrapper for client components: JSON in, JSON out, English error messages. */
export async function api<T>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: isForm || !options.body ? undefined : { "Content-Type": "application/json" },
    body: isForm ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  }).catch(() => {
    throw new Error("Can't reach the server. Check your connection.");
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
