import { NextResponse } from "next/server";
import { AuthError, requireApprovedMember, requireSigner } from "@/core/auth";
import { browseListings, createListing, type BrowseSort } from "@/core/listings";
import { parseUsdc } from "@/core/chain";

export const dynamic = "force-dynamic";

/** GET /api/listings — the browse screen's data, ranked by owner track record. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = (url.searchParams.get("sort") ?? "trust") as BrowseSort;
  const search = url.searchParams.get("q") ?? undefined;
  const includeUnavailable = url.searchParams.get("all") === "1";

  return NextResponse.json({ listings: browseListings({ sort, search, includeUnavailable }) });
}

/** POST /api/listings — list a tool you own. Requires a signed request. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = await requireSigner("create-listing", body);
    requireApprovedMember(address);

    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const deposit = parseUsdc(String(body.deposit ?? "0"));
    const dailyLateFee = parseUsdc(String(body.dailyLateFee ?? "0"));
    const maxDays = Number(body.maxDays ?? 7);

    if (deposit <= 0n) return NextResponse.json({ error: "deposit must be greater than zero" }, { status: 400 });
    // Mirrors the contract's own check, so a listing can never produce a
    // request the contract will reject.
    if (dailyLateFee > deposit) {
      return NextResponse.json({ error: "daily late fee cannot exceed the deposit" }, { status: 400 });
    }
    if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 90) {
      return NextResponse.json({ error: "max days must be between 1 and 90" }, { status: 400 });
    }

    const listing = createListing(address, {
      title,
      description: String(body.description ?? ""),
      conditionNote: String(body.conditionNote ?? ""),
      photoUrl: body.photoUrl ? String(body.photoUrl) : null,
      deposit: deposit.toString(),
      dailyLateFee: dailyLateFee.toString(),
      maxDays,
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad request" }, { status: 400 });
  }
}
