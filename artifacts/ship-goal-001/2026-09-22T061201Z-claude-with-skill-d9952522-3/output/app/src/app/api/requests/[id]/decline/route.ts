import {HttpError, handler, json, requireMember} from "@/server/http.ts";
import {getListing} from "@/server/listings.ts";
import {getRequest, setRequestStatus} from "@/server/requests.ts";

type Params = {params: Promise<{id: string}>};

/** Owner declines, or borrower withdraws. */
export const POST = handler(async (_request: Request, {params}: Params) => {
  const member = await requireMember();
  const {id} = await params;

  const borrowRequest = getRequest(id);
  if (!borrowRequest) throw new HttpError(404, "No such request.");
  const listing = getListing(borrowRequest.listingId);
  if (!listing) throw new HttpError(404, "No such tool.");

  const isOwner = listing.ownerAddress === member.address;
  const isBorrower = borrowRequest.borrowerAddress === member.address;
  if (!isOwner && !isBorrower) throw new HttpError(403, "Not your request.");
  if (borrowRequest.status === "opened") {
    throw new HttpError(409, "That loan has already started — settle it onchain instead.");
  }

  setRequestStatus(id, isOwner ? "declined" : "withdrawn");
  return json({request: getRequest(id)});
});
