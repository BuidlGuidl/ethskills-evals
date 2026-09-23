import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { billingAbi } from "./abi.js";

/**
 * The solvency check to wire into your monitoring. `surplus()` should be 0 and
 * the contract's token balance should equal what it owes. If these ever
 * disagree, stop and investigate before touching anything.
 */
export async function checkSolvency(contract: Address, rpcUrl: string) {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

  const [subscriberFunds, revenue, surplus] = await Promise.all([
    client.readContract({ address: contract, abi: billingAbi, functionName: "totalSubscriberBalance" }),
    client.readContract({ address: contract, abi: billingAbi, functionName: "revenueAccrued" }),
    client.readContract({ address: contract, abi: billingAbi, functionName: "surplus" }),
  ]);

  return {
    subscriberFunds,
    revenue,
    surplus,
    /** Surplus above zero means tokens arrived outside `deposit` — usually someone
     * transferring USDC straight to the contract by mistake. Not dangerous, but it
     * is stuck: there is no rescue function. Worth an alert so you can help them. */
    healthy: surplus === 0n,
  };
}
