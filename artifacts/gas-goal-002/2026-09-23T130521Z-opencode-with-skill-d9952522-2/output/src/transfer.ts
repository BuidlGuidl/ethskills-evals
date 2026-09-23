import { Rpc } from "./rpc.ts";
import { decideFeesLive, type FeeDecision, type FeePolicy } from "./fees.ts";
import { padAddress, padUint } from "./abi.ts";

// keccak256("transfer(address,uint256)")[0:4]
const TRANSFER_SELECTOR = "a9059cbb";

export function encodeTransfer(to: string, amount: bigint): `0x${string}` {
  return `0x${TRANSFER_SELECTOR}${padAddress(to)}${padUint(amount)}`;
}

export interface UnsignedTx {
  to: string;
  data: `0x${string}`;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  type: 2;
}

/**
 * Build a fee-disciplined unsigned ERC-20 transfer. The relayer's existing
 * signer (ethers/viem/kms) fills nonce/gasLimit and signs.
 *
 * Throws if the fee policy says hold — the caller's queue should retry later.
 */
export async function buildTransferTx(
  rpc: Rpc,
  token: string,
  to: string,
  amount: bigint,
  policy?: FeePolicy,
): Promise<UnsignedTx> {
  const decision: FeeDecision = await decideFeesLive(rpc, policy);
  if (!decision.send) throw new Error(`fee hold: ${decision.reason}`);
  return {
    to: token,
    data: encodeTransfer(to, amount),
    maxFeePerGas: decision.maxFeePerGas,
    maxPriorityFeePerGas: decision.maxPriorityFeePerGas,
    type: 2,
  };
}
