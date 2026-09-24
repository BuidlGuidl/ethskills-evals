import {
  HttpError,
  handler,
  json,
  optionalString,
  requireHex32,
  requireInt,
  requireMember,
} from "@/server/http.ts";
import {getListing, isOnLoan} from "@/server/listings.ts";
import {createRequest, pendingRequestsForOwner, requestsByBorrower} from "@/server/requests.ts";

/** Both sides of my queue: what I have asked for, and what people have asked me for. */
export const GET = handler(async () => {
  const member = await requireMember();
  return json({
    incoming: pendingRequestsForOwner(member.address),
    outgoing: requestsByBorrower(member.address),
  });
});

/** Ask to borrow a tool. Creates nothing onchain — it is a message until the owner signs. */
export const POST = handler(async (request: Request) => {
  const member = await requireMember();
  const body = (await request.json()) as Record<string, unknown>;
  const listingId = requireHex32(body.listingId, "listingId");

  const listing = getListing(listingId);
  if (!listing) throw new HttpError(404, "No such tool.");
  if (listing.status !== "available") throw new HttpError(409, "That tool is not being lent right now.");
  if (listing.ownerAddress === member.address) throw new HttpError(400, "That is your own tool.");
  if (isOnLoan(listingId)) throw new HttpError(409, "That tool is already out on loan.");

  const days = requireInt(body.days, "Days", 1, listing.maxDays);

  return json(
    {
      request: createRequest({
        listingId,
        borrowerAddress: member.address,
        message: optionalString(body.message, "Message", 1_000),
        days,
      }),
    },
    201,
  );
});
