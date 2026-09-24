import { NextResponse } from "next/server";
import { fetchFeed, FEED_HEAD } from "@/graphql/queries";

export const dynamic = "force-dynamic";

/**
 * Proxy for the feed query. Exists so the browser can poll for new check-ins
 * without ever holding the subgraph URL (which carries the gateway API key).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const first = Math.min(Number(params.get("first") ?? 50) || 50, 100);
  const cursor = params.get("cursor") ?? FEED_HEAD;

  try {
    const page = await fetchFeed({ first, cursor });
    return NextResponse.json(page, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("feed query failed", error);
    return NextResponse.json({ error: "Subgraph unavailable" }, { status: 502 });
  }
}
