const reads = new Map<string, { expires: number; response: Promise<Response> }>();
const pendingReads = new Map<string, { generation: number; response: Promise<Response> }>();
let generation = 0;

/** Share concurrent reads and reuse recent responses when navigating back. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if ((init?.method || "GET").toUpperCase() !== "GET") {
    generation++; reads.clear();
    const response = await fetch(url, init);
    generation++; reads.clear();
    if (response.ok) window.dispatchEvent(new CustomEvent("vouch:data-changed", { detail: { url } }));
    return response;
  }
  const bypassCache = init?.cache === "no-store";
  if (bypassCache) reads.delete(url);
  else {
    const cached = reads.get(url);
    if (cached && cached.expires > Date.now()) return (await cached.response).clone();
  }
  const pending = pendingReads.get(url);
  if (pending && pending.generation === generation) return (await pending.response).clone();
  const requestGeneration = generation;
  const response = fetch(url, init);
  const pendingEntry = { generation: requestGeneration, response };
  pendingReads.set(url, pendingEntry);
  const entry = { expires: Date.now() + 15_000, response };
  if (!bypassCache) reads.set(url, entry);
  try {
    const result = await response;
    if (!result.ok && reads.get(url) === entry) reads.delete(url);
    return result.clone();
  } catch (error) {
    if (reads.get(url) === entry) reads.delete(url);
    throw error;
  } finally {
    if (pendingReads.get(url) === pendingEntry) pendingReads.delete(url);
  }
}

export function prefetchApi(url: string) {
  void apiFetch(url).catch(() => undefined);
}
