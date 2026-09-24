import { NextResponse } from "next/server";
import { AuthError, requireSigner } from "@/core/auth";
import { db, nowSeconds } from "@/core/db";
import { allTrackRecords } from "@/core/reputation";

export const dynamic = "force-dynamic";

/** GET /api/members — the directory, ranked by track record. */
export async function GET() {
  const records = [...allTrackRecords().values()].sort((a, b) => b.score - a.score);
  return NextResponse.json({ members: records });
}

/**
 * POST /api/members — join, or update your own profile.
 *
 * New members land unapproved. An association admin flips `approved` via
 * PATCH /api/members/:address before they can list or borrow through the app.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const address = await requireSigner("join", body);

    const displayName = String(body.displayName ?? "").trim();
    if (!displayName) return NextResponse.json({ error: "displayName is required" }, { status: 400 });

    const autoApprove = process.env.TOOLSHED_OPEN_SIGNUP === "1" ? 1 : 0;

    db()
      .prepare(
        `INSERT INTO members (address, display_name, unit, bio, approved, joined_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(address) DO UPDATE SET
           display_name = excluded.display_name,
           unit = excluded.unit,
           bio = excluded.bio`,
      )
      .run(address, displayName, body.unit ? String(body.unit) : null, body.bio ? String(body.bio) : null, autoApprove, nowSeconds());

    const member = db().prepare("SELECT * FROM members WHERE address = ?").get(address);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad request" }, { status: 400 });
  }
}
