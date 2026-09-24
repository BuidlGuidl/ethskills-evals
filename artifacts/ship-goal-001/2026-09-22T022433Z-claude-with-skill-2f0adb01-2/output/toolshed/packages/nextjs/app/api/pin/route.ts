import { NextRequest, NextResponse } from "next/server";

/**
 * Pins a listing's photo or JSON to IPFS through Pinata, using a key that never leaves the server.
 *
 * This route is optional. Without PINATA_JWT the listing form falls back to a pasted photo URL and
 * an inline `data:` metadata URI.
 *
 * `force-static` is what keeps a static IPFS export buildable: in that mode Next bakes the GET
 * response (`{ configured: false }` — there is no server to hold a key) and drops the POST handler,
 * so the form takes the fallback path. On Vercel the route runs normally.
 */
export const dynamic = "force-static";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_BASE = "https://api.pinata.cloud/pinning";

export const GET = async () => NextResponse.json({ configured: Boolean(PINATA_JWT) });

export const POST = async (request: NextRequest) => {
  if (!PINATA_JWT) {
    return new NextResponse("Pinning is not configured on this deployment (set PINATA_JWT)", { status: 501 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const metadata = await request.json();
      const response = await fetch(`${PINATA_BASE}/pinJSONToIPFS`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PINATA_JWT}` },
        body: JSON.stringify({ pinataContent: metadata }),
      });
      if (!response.ok) return new NextResponse(await response.text(), { status: 502 });
      const { IpfsHash } = (await response.json()) as { IpfsHash: string };
      return NextResponse.json({ uri: `ipfs://${IpfsHash}` });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return new NextResponse("No file in the request", { status: 400 });
    if (file.size > 10 * 1024 * 1024) return new NextResponse("Photo is larger than 10MB", { status: 413 });

    const upload = new FormData();
    upload.append("file", file);
    const response = await fetch(`${PINATA_BASE}/pinFileToIPFS`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: upload,
    });
    if (!response.ok) return new NextResponse(await response.text(), { status: 502 });
    const { IpfsHash } = (await response.json()) as { IpfsHash: string };
    return NextResponse.json({ uri: `ipfs://${IpfsHash}` });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Pinning failed", { status: 500 });
  }
};
