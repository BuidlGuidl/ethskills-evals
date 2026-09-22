import {verifyTypedData} from "viem";

import {HttpError, handler, json, requireInt, requireMember, requireString} from "@/server/http.ts";
import {getLoan, saveReceipt} from "@/server/loans.ts";
import {RECEIPT_TYPES, eip712Domain} from "@/core/eip712.ts";
import {chainConfig} from "@/contracts/config.ts";

type Params = {params: Promise<{loanId: string}>};

/**
 * The owner hands over a signed return receipt.
 *
 * This is the borrower's insurance. Once the owner has the tool back, late fees should stop —
 * but only the owner can call `confirmReturn`, and people forget. A receipt lets the borrower
 * call `closeWithReceipt` themselves and settle at the time written on it, not at whatever time
 * the owner eventually gets round to it.
 *
 * Owners should sign this at the doorstep, the moment the tool changes hands.
 */
export const POST = handler(async (request: Request, {params}: Params) => {
  const member = await requireMember();
  const {loanId} = await params;

  const loan = getLoan(loanId);
  if (!loan) throw new HttpError(404, "No such loan.");
  if (loan.ownerAddress !== member.address) throw new HttpError(403, "Only the owner signs receipts.");
  if (loan.status !== "active") throw new HttpError(409, "That loan is not open.");

  const body = (await request.json()) as {returnedAt?: unknown; signature?: unknown};
  const returnedAt = requireInt(body.returnedAt, "returnedAt", loan.startedAt, 2_000_000_000);
  if (returnedAt > Math.floor(Date.now() / 1000) + 300) {
    throw new HttpError(400, "A receipt cannot be dated in the future.");
  }
  const signature = requireString(body.signature, "signature", 2_000);

  const {chainId, escrowAddress} = chainConfig();
  const valid = await verifyTypedData({
    address: member.address as `0x${string}`,
    domain: eip712Domain(chainId, escrowAddress),
    types: RECEIPT_TYPES,
    primaryType: "Receipt",
    message: {loanId: loanId as `0x${string}`, returnedAt: BigInt(returnedAt)},
    signature: signature as `0x${string}`,
  });
  if (!valid) throw new HttpError(400, "That signature does not match this loan.");

  saveReceipt(loanId, returnedAt, signature);
  return json({loan: getLoan(loanId)});
});
