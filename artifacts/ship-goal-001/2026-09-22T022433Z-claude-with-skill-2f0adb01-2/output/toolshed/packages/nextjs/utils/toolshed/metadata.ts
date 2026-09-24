import type { ToolMetadata } from "./types";

/**
 * Tool photos and condition notes live offchain. A listing stores one `metadataURI` onchain — an
 * IPFS URI pointing at a small JSON blob — because a photo is not something a contract should ever
 * hold, and because IPFS keeps the listing readable even if this frontend disappears.
 *
 * Any HTTP(S) URL works too, which is what you get if you skip the pinning service and paste a
 * link. The gateway is configurable so an association can run its own.
 */
export const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/$/, "") || "https://ipfs.io/ipfs";

export const resolveUri = (uri: string | undefined): string => {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}/${uri.slice("ipfs://".length)}`;
  // A bare CID is a common paste; treat it as IPFS.
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58})/.test(uri)) return `${IPFS_GATEWAY}/${uri}`;
  return uri;
};

const cache = new Map<string, ToolMetadata>();

/** Fetches and caches a listing's JSON. Never throws: a broken pin should not blank the screen. */
export const fetchToolMetadata = async (uri: string): Promise<ToolMetadata> => {
  if (cache.has(uri)) return cache.get(uri) as ToolMetadata;
  const fallback: ToolMetadata = { name: "Untitled tool" };
  const url = resolveUri(uri);
  if (!url) return fallback;
  try {
    const response = await fetch(url);
    if (!response.ok) return fallback;
    const json = (await response.json()) as ToolMetadata;
    const metadata: ToolMetadata = {
      name: json.name || "Untitled tool",
      description: json.description,
      condition: json.condition,
      image: json.image,
    };
    cache.set(uri, metadata);
    return metadata;
  } catch {
    return fallback;
  }
};

export type PinResult = { uri: string };

/**
 * Uploads through this app's `/api/pin` route, which talks to Pinata with a server-side key.
 * If the route is not configured, the caller falls back to asking for a URL by hand.
 */
export const pinFile = async (file: File): Promise<PinResult> => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/pin", { method: "POST", body });
  if (!response.ok) throw new Error((await response.text()) || "Pinning failed");
  return response.json();
};

export const pinJson = async (metadata: ToolMetadata): Promise<PinResult> => {
  const response = await fetch("/api/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) throw new Error((await response.text()) || "Pinning failed");
  return response.json();
};

export const pinningConfigured = async (): Promise<boolean> => {
  try {
    const response = await fetch("/api/pin");
    if (!response.ok) return false;
    const json = (await response.json()) as { configured: boolean };
    return json.configured;
  } catch {
    return false;
  }
};
