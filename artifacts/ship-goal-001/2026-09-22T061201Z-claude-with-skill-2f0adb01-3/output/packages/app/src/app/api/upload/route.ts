import { NextResponse } from "next/server";

/**
 * Turns a listing form into the single metadata URI the contract stores.
 *
 * With PINATA_JWT set, the photo and the JSON are both pinned to IPFS and the caller gets back
 * `ipfs://<cid>` — the photo outlives this server. Without it, we fall back to an inline
 * `data:` URI (plus whatever image URL the member pasted) so a developer can run the whole app
 * with no third-party account. The fallback is fine for a test chain and wrong for production:
 * the JSON then lives in contract storage, which costs gas and cannot be edited cheaply.
 */

const PINATA_JSON = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_FILE = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Metadata = { name: string; condition: string; image: string };

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const condition = String(form.get("condition") ?? "").trim();
  const imageUrl = String(form.get("imageUrl") ?? "").trim();
  const photo = form.get("photo");

  if (!name) return NextResponse.json({ error: "A tool needs a name." }, { status: 400 });

  const jwt = process.env.PINATA_JWT;
  const file = photo instanceof File && photo.size > 0 ? photo : null;

  if (file && file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Photo must be under 5 MB." }, { status: 400 });
  }
  if (file && !jwt) {
    return NextResponse.json(
      { error: "Photo uploads need PINATA_JWT on the server. Paste an image URL instead." },
      { status: 400 },
    );
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith("ipfs://")) {
    return NextResponse.json({ error: "Image URL must start with https:// or ipfs://" }, { status: 400 });
  }

  try {
    let image = imageUrl;
    if (file && jwt) image = `ipfs://${await pinFile(file, jwt)}`;

    const metadata: Metadata = { name, condition, image };

    if (jwt) {
      const cid = await pinJson(metadata, jwt, name);
      return NextResponse.json({ metadataURI: `ipfs://${cid}`, pinned: true });
    }
    return NextResponse.json({
      metadataURI: `data:application/json;utf8,${JSON.stringify(metadata)}`,
      pinned: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function pinFile(file: File, jwt: string): Promise<string> {
  const body = new FormData();
  body.append("file", file, file.name || "tool-photo");
  const res = await fetch(PINATA_FILE, { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body });
  if (!res.ok) throw new Error(`Pinning the photo failed (${res.status})`);
  const { IpfsHash } = (await res.json()) as { IpfsHash: string };
  return IpfsHash;
}

async function pinJson(metadata: Metadata, jwt: string, name: string): Promise<string> {
  const res = await fetch(PINATA_JSON, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ pinataContent: metadata, pinataMetadata: { name: `toolshed-${name}` } }),
  });
  if (!res.ok) throw new Error(`Pinning the listing failed (${res.status})`);
  const { IpfsHash } = (await res.json()) as { IpfsHash: string };
  return IpfsHash;
}
