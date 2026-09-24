import { NextResponse } from "next/server";
import { AuthError, requireApprovedMember, requireSigner } from "@/core/auth";
import { getListing, updateListing } from "@/core/listings";
import { loansForListing } from "@/core/loans";
import { parseUsdc } from "@/core/chain";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const listing = getListing(id);
  if (!listing) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ listing, loans: loansForListing(id) });
}

/** PATCH /api/listings/:id — edit terms, condition notes, or availability. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const address = await requireSigner("update-listing", body);
    requireApprovedMember(address);

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.conditionNote !== undefined) patch.conditionNote = String(body.conditionNote);
    if (body.photoUrl !== undefined) patch.photoUrl = body.photoUrl ? String(body.photoUrl) : null;
    if (body.deposit !== undefined) patch.deposit = parseUsdc(String(body.deposit)).toString();
    if (body.dailyLateFee !== undefined) patch.dailyLateFee = parseUsdc(String(body.dailyLateFee)).toString();
    if (body.maxDays !== undefined) patch.maxDays = Number(body.maxDays);
    if (body.available !== undefined) patch.available = Boolean(body.available);

    const existing = getListing(id);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

    const deposit = BigInt((patch.deposit as string | undefined) ?? existing.deposit);
    const fee = BigInt((patch.dailyLateFee as string | undefined) ?? existing.dailyLateFee);
    if (fee > deposit) {
      return NextResponse.json({ error: "daily late fee cannot exceed the deposit" }, { status: 400 });
    }

    return NextResponse.json({ listing: updateListing(id, address, patch) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "bad request";
    return NextResponse.json({ error: message }, { status: message === "not your listing" ? 403 : 400 });
  }
}
