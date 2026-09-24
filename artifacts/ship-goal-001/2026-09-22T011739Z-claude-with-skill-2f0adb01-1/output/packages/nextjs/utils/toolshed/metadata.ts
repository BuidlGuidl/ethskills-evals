import { ToolMetadata } from "./types";
import { create } from "kubo-rpc-client";

/**
 * Listing content (name, photo, condition notes) lives offchain; only the URI is stored onchain.
 *
 * Two backends, picked by configuration:
 *  - IPFS, when NEXT_PUBLIC_IPFS_API_URL points at a Kubo RPC endpoint you can write to.
 *    Photos are uploaded as files and the JSON references them by CID.
 *  - A `data:` URI otherwise, holding the same JSON inline with the photo as a link. This keeps
 *    a fresh clone working with no infrastructure at all; it costs a few hundred bytes of
 *    calldata per listing (pennies on Base) and cannot hold image bytes, only image URLs.
 */
const IPFS_API_URL = process.env.NEXT_PUBLIC_IPFS_API_URL;
export const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs/";

export const ipfsConfigured = Boolean(IPFS_API_URL);

const ipfsClient = () => create({ url: IPFS_API_URL as string });

/** Upload raw image bytes. Only available when IPFS is configured. */
export const uploadPhoto = async (file: File): Promise<string> => {
  if (!ipfsConfigured) throw new Error("No IPFS endpoint configured — paste a photo URL instead");
  const { cid } = await ipfsClient().add(file);
  return `ipfs://${cid.toString()}`;
};

export const publishMetadata = async (metadata: ToolMetadata): Promise<string> => {
  const json = JSON.stringify(metadata);
  if (ipfsConfigured) {
    const { cid } = await ipfsClient().add(json);
    return `ipfs://${cid.toString()}`;
  }
  return `data:application/json;base64,${toBase64(json)}`;
};

export const resolveUri = (uri: string): string =>
  uri.startsWith("ipfs://") ? `${IPFS_GATEWAY}${uri.slice("ipfs://".length)}` : uri;

export const fetchMetadata = async (uri: string): Promise<ToolMetadata> => {
  if (uri.startsWith("data:")) {
    const [, payload] = uri.split(",", 2);
    const json = uri.includes(";base64,") ? fromBase64(payload) : decodeURIComponent(payload);
    return normalize(JSON.parse(json));
  }
  const res = await fetch(resolveUri(uri));
  if (!res.ok) throw new Error(`Could not load listing metadata (${res.status})`);
  return normalize(await res.json());
};

const normalize = (raw: Partial<ToolMetadata>): ToolMetadata => ({
  name: raw.name?.toString() ?? "Unnamed tool",
  photo: raw.photo?.toString() ?? "",
  condition: raw.condition?.toString() ?? "",
});

// btoa/atob are byte-oriented; go through UTF-8 so accented names survive the round trip.
const toBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes));
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};
