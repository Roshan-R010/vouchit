const reads = new Map<string, { expires: number; response: Promise<Response> }>();

/** Share concurrent reads and reuse recent responses when navigating back. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (init?.cache === "no-store") reads.delete(url);
  if ((init?.method || "GET").toUpperCase() !== "GET") {
    reads.clear();
    const response = await fetch(url, init);
    reads.clear();
    if (response.ok) window.dispatchEvent(new Event("vouch:data-changed"));
    return response;
  }
  const cached = reads.get(url);
  if (cached && cached.expires > Date.now()) return (await cached.response).clone();
  const entry = { expires: Date.now() + 15000, response: fetch(url, init) };
  reads.set(url, entry);
  try {
    const response = await entry.response;
    if (!response.ok && reads.get(url) === entry) reads.delete(url);
    return response.clone();
  } catch (error) {
    if (reads.get(url) === entry) reads.delete(url);
    throw error;
  }
}

export function prefetchApi(url: string) {
  void apiFetch(url).catch(() => undefined);
}
