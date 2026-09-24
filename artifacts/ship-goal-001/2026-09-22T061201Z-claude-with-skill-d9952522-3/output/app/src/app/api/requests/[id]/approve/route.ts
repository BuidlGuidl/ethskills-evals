import {verifyTypedData} from "viem";

import {
  HttpError,
  handler,
  json,
  requireAddress,
  requireHex32,
  requireMember,
  requireString,
} from "@/server/http.ts";
import {getListing, isOnLoan} from "@/server/listings.ts";
import {activeApprovalsForListing, approveRequest, getRequest} from "@/server/requests.ts";
import {TERMS_TYPES, deserialiseTerms, eip712Domain, type SerialisedTerms} from "@/core/eip712.ts";
import {chainConfig} from "@/contracts/config.ts";

type Params = {params: Promise<{id: string}>};

/**
 * Records the owner's approval: the terms they signed, and the signature.
 *
 * The signature is what actually authorises the loan — the borrower carries it onchain. We store
 * it so the borrower can pick it up, and so the indexer can match the resulting `LoanOpened`
 * event back to this request. Nothing here can create a loan on its own; if this server were
 * compromised, the worst it could do is fail to show a member a signature the owner already made.
 */
export const POST = handler(async (request: Request, {params}: Params) => {
  const member = await requireMember();
  const {id} = await params;

  const borrowRequest = getRequest(id);
  if (!borrowRequest) throw new HttpError(404, "No such request.");
  if (borrowRequest.status !== "pending") throw new HttpError(409, "That request is already dealt with.");

  const listing = getListing(borrowRequest.listingId);
  if (!listing) throw new HttpError(404, "No such tool.");
  if (listing.ownerAddress !== member.address) throw new HttpError(403, "Not your tool.");
  if (isOnLoan(listing.id)) throw new HttpError(409, "That tool is already out on loan.");
  if (activeApprovalsForListing(listing.id).length > 0) {
    throw new HttpError(409, "You have already approved someone for this tool. Wait for that offer to expire or be collected.");
  }

  const body = (await request.json()) as {terms?: unknown; signature?: unknown; loanId?: unknown};
  if (typeof body.terms !== "object" || body.terms === null) {
    throw new HttpError(400, "terms is required.");
  }
  const raw = body.terms as SerialisedTerms;
  const terms = deserialiseTerms(raw);

  // The client builds and signs the terms; re-check the fields that matter before we store them,
  // so a member's own browser cannot quietly approve something other than what was on screen.
  if (requireAddress(terms.owner, "terms.owner") !== member.address) {
    throw new HttpError(400, "Those terms are not from you.");
  }
  if (requireAddress(terms.borrower, "terms.borrower") !== borrowRequest.borrowerAddress) {
    throw new HttpError(400, "Those terms name a different borrower.");
  }
  if (requireHex32(terms.listingId, "terms.listingId") !== listing.id) {
    throw new HttpError(400, "Those terms are for a different tool.");
  }
  if (terms.deposit !== listing.deposit || terms.dailyLateFee !== listing.dailyLateFee) {
    throw new HttpError(400, "Those terms do not match the listing's deposit and late fee.");
  }
  if (terms.dailyLateFee === 0n || terms.dailyLateFee > terms.deposit || terms.deposit === 0n) {
    throw new HttpError(400, "The contract would reject those terms.");
  }

  const signature = requireString(body.signature, "signature", 2_000);
  const {chainId, escrowAddress} = chainConfig();

  // Not a security boundary — the contract checks the signature itself, and is the only thing
  // that can move money. But verifying here means a client that has drifted out of sync with the
  // contract's typehash is caught now, rather than as an opaque `BadSignature()` revert after the
  // borrower has already walked over to collect the tool.
  const signedByOwner = await verifyTypedData({
    address: member.address as `0x${string}`,
    domain: eip712Domain(chainId, escrowAddress),
    types: TERMS_TYPES,
    primaryType: "Terms",
    message: terms,
    signature: signature as `0x${string}`,
  });
  if (!signedByOwner) {
    throw new HttpError(400, "That signature does not match the terms. Try approving again.");
  }

  approveRequest({
    requestId: id,
    terms: raw,
    signature,
    loanId: requireHex32(body.loanId, "loanId"),
  });

  return json({request: getRequest(id)});
});
