import { isAllowedImageHost } from "./image-hosts";

// Museum image servers (often behind a CDN) may refuse requests that don't
// identify themselves. AIC also asks API clients to send AIC-User-Agent.
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; VirtualComprehensiveMuseum/0.1; open-access research project)",
  "AIC-User-Agent": "virtual-comprehensive-museum (open-access research project)",
  Accept: "image/avif,image/webp,image/jpeg,image/*;q=0.8",
};

export type ImageFetchResult =
  | { ok: true; body: ReadableStream<Uint8Array>; contentType: string }
  | { ok: false; reason: string };

/** Fetches an already-approved image URL from an allowed museum host. */
export async function fetchApprovedImage(url: string, timeoutMs = 20_000): Promise<ImageFetchResult> {
  if (!isAllowedImageHost(url)) return { ok: false, reason: "host not allowed" };
  let res: Response;
  try {
    res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    return { ok: false, reason: `${(err as Error).name}: ${(err as Error).message}${cause ? ` (${cause})` : ""}` };
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
  if (!contentType.startsWith("image/")) return { ok: false, reason: `not an image (content-type "${contentType}")` };
  if (!res.body) return { ok: false, reason: "empty body" };
  return { ok: true, body: res.body, contentType };
}
