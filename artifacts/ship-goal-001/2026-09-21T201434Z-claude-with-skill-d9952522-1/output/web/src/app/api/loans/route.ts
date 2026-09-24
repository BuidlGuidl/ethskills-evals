import { NextResponse } from "next/server";
import { AuthError, requireSigner } from "@/core/auth";
import { linkLoanToListing, loansFor } from "@/core/loans";
import { getListing } from "@/core/listings";

export const dynamic = "force-dynamic";

/** GET /api/loans?address=0x… — every loan this member is party to. */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
  return NextResponse.json({ loans: loansFor(address) });
}

/**
 * POST /api/loans — records which listing a just-submitted onchain loan was
 * for. Purely a convenience link: the loan itself already exists onchain, and
 * the indexer can recover this mapping from the listingRef hash if the client
 * never gets here (tab closed, network blip).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = await requireSigner("link-loan", body);

    const loanId = Number(body.loanId);
    const listingId = String(body.listingId ?? "");
    if (!Number.isInteger(loanId) || loanId <= 0) {
      return NextResponse.json({ error: "loanId must be a positive integer" }, { status: 400 });
    }

    const listing = getListing(listingId);
    if (!listing) return NextResponse.json({ error: "unknown listing" }, { status: 404 });

    linkLoanToListing(loanId, listingId);
    return NextResponse.json({ ok: true, loanId, listingId, by: address });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad request" }, { status: 400 });
  }
}
