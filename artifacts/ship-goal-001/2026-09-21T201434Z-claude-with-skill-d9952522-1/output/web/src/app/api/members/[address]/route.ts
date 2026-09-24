import { NextResponse } from "next/server";
import { AuthError, isAdmin, requireSigner } from "@/core/auth";
import { db } from "@/core/db";
import { trackRecordFor } from "@/core/reputation";
import { listingsByOwner } from "@/core/listings";
import { loansFor } from "@/core/loans";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

/** GET /api/members/:address — profile, track record, listings, loan history. */
export async function GET(_request: Request, { params }: Params) {
  const { address } = await params;
  const key = address.toLowerCase();

  const member = db().prepare("SELECT * FROM members WHERE address = ?").get(key);
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    member,
    trackRecord: trackRecordFor(key),
    listings: listingsByOwner(key),
    loans: loansFor(key),
  });
}

/** PATCH /api/members/:address — admin-only membership approval. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { address } = await params;
    const body = await request.json();
    const caller = await requireSigner("approve-member", body);

    if (!isAdmin(caller)) {
      return NextResponse.json({ error: "admin only" }, { status: 403 });
    }

    const result = db()
      .prepare("UPDATE members SET approved = ? WHERE address = ?")
      .run(body.approved ? 1 : 0, address.toLowerCase());

    if (result.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json({ member: db().prepare("SELECT * FROM members WHERE address = ?").get(address.toLowerCase()) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad request" }, { status: 400 });
  }
}
