import { createPublicClient, createWalletClient, http, parseAbiItem, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { billingAbi } from "./abi.js";

/**
 * Settles subscribers and moves earned revenue into the operator pot.
 *
 * This is the ONE thing in the system that needs somebody to poke it, and it is
 * the easy kind: the poker is you, and the reason is that it is how you get
 * paid. Nothing breaks if it is late — accrual has already happened in the
 * subscribers' balances, this only relabels it. Run it monthly; running it more
 * often just costs more gas for the same money.
 *
 * `collect` is permissionless on purpose, so this script does not need the owner
 * key. Only `withdrawRevenue` does.
 *
 *   BILLING=0x... RPC_URL=... DEPLOY_BLOCK=12345678 node dist/sweep.js
 */

const BATCH_SIZE = 100;

export async function findSubscribers(params: {
  contract: Address;
  rpcUrl: string;
  fromBlock: bigint;
}): Promise<Address[]> {
  const client = createPublicClient({ chain: base, transport: http(params.rpcUrl) });

  // Every subscriber emitted `Subscribed` at least once. Addresses that later
  // cancelled are harmless to include: `collect` on them is a no-op.
  const logs = await client.getLogs({
    address: params.contract,
    event: parseAbiItem("event Subscribed(address indexed account, uint16 indexed planId, uint256 activeUntil)"),
    fromBlock: params.fromBlock,
    toBlock: "latest",
  });

  return [...new Set(logs.map((l) => l.args.account as Address))];
}

export async function sweep(params: {
  contract: Address;
  rpcUrl: string;
  fromBlock: bigint;
  privateKey: `0x${string}`;
}): Promise<{ swept: number; batches: number }> {
  const account = privateKeyToAccount(params.privateKey);
  const wallet = createWalletClient({ account, chain: base, transport: http(params.rpcUrl) });
  const subscribers = await findSubscribers(params);

  let batches = 0;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    await wallet.writeContract({
      address: params.contract,
      abi: billingAbi,
      functionName: "collectMany",
      args: [batch],
    });
    batches++;
  }

  return { swept: subscribers.length, batches };
}

// --- CLI entrypoint: `node backend/dist/src/sweep.js` -------------------------
// Settling is permissionless, so SWEEPER_KEY can be a throwaway hot key holding
// a dollar of gas. It has no authority over the contract: it cannot withdraw
// revenue, touch balances, or change plans. Keep the owner key well away from
// this machine.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`missing env var ${name}`);
    return value;
  };

  const result = await sweep({
    contract: required("BILLING") as Address,
    rpcUrl: required("RPC_URL"),
    fromBlock: BigInt(required("DEPLOY_BLOCK")),
    privateKey: required("SWEEPER_KEY") as `0x${string}`,
  });

  console.log(`settled ${result.swept} subscribers in ${result.batches} transaction(s)`);
}
