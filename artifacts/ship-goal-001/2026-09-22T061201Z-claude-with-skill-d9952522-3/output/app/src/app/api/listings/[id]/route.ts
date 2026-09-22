import {HttpError, handler, json, requireMember} from "@/server/http.ts";
import {getListing, updateListingStatus} from "@/server/listings.ts";
import {loansForListing} from "@/server/loans.ts";
import {trackRecord} from "@/server/members.ts";

type Params = {params: Promise<{id: string}>};

export const GET = handler(async (_request: Request, {params}: Params) => {
  const {id} = await params;
  const listing = getListing(id);
  if (!listing) throw new HttpError(404, "No such tool.");
  return json({
    listing,
    ownerRecord: trackRecord(listing.ownerAddress),
    loans: loansForListing(id),
  });
});

/** Pause, resume or retire a listing. Owner only. */
export const PATCH = handler(async (request: Request, {params}: Params) => {
  const member = await requireMember();
  const {id} = await params;
  const listing = getListing(id);
  if (!listing) throw new HttpError(404, "No such tool.");
  if (listing.ownerAddress !== member.address) throw new HttpError(403, "Not your tool.");

  const body = (await request.json()) as {status?: unknown};
  if (body.status !== "available" && body.status !== "paused" && body.status !== "retired") {
    throw new HttpError(400, "status must be available, paused or retired.");
  }
  updateListingStatus(id, body.status);
  return json({listing: getListing(id)});
});
