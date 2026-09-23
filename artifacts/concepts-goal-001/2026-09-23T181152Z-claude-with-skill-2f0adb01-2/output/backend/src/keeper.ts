import { createWalletClient, http, parseAbiItem, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { billingAbi } from "./abi.js";
import { publicClient } from "./billing.js";
import { config } from "./config.js";

/**
 * The settlement job -- this is how the merchant actually gets paid.
 *
 * Worth being clear about what this is NOT: it is not a cron that "runs the
 * subscriptions". Subscriptions do not need running. Customers are entitled to
 * service purely by arithmetic over funds they already deposited, whether or not
 * this script ever executes. All `settle` does is convert elapsed periods into
 * withdrawable revenue and move the money out.
 *
 * Consequences of that split, worth internalising before relying on it:
 *   - If this job is down for a month, no customer is over- or under-charged and
 *     no revenue is lost. It all settles correctly on the next run, in closed form.
 *   - Nobody else needs to be paid to run it. The incentive is direct: whoever
 *     calls it releases the merchant's own money to the merchant's own address.
 *   - `withdrawRevenue` is permissionless and hardcoded to `payoutAddress`, so the
 *     key this job uses only needs gas. It cannot redirect a single cent.
 *     Keep the owner key offline and out of this process.
 */

const SETTLE_BATCH = 100;
const LOG_CHUNK = 10_000n; // most RPCs cap eth_getLogs ranges

const subscribedEvent = parseAbiItem(
  "event Subscribed(address indexed account, uint32 indexed planId, uint128 price, uint64 paidThrough)",
);

/** Every address that has ever subscribed. Cheap enough at hobby-project scale. */
async function findKnownSubscribers(): Promise<Address[]> {
  const latest = await publicClient.getBlockNumber();
  const seen = new Set<Address>();

  for (let from = config.deployBlock; from <= latest; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n > latest ? latest : from + LOG_CHUNK - 1n;
    const logs = await publicClient.getLogs({
      address: config.billingAddress,
      event: subscribedEvent,
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) if (log.args.account) seen.add(log.args.account);
  }
  return [...seen];
}

/** Narrow to accounts whose current period has actually elapsed. */
async function findDueForSettlement(candidates: Address[]): Promise<Address[]> {
  if (candidates.length === 0) return [];
  const now = BigInt(Math.floor(Date.now() / 1000));

  const accounts = await publicClient.multicall({
    contracts: candidates.map((account) => ({
      address: config.billingAddress,
      abi: billingAbi,
      functionName: "accountOf" as const,
      args: [account] as const,
    })),
    allowFailure: false,
  });

  return candidates.filter((_, i) => {
    const a = accounts[i] as { paidThrough: bigint; planId: number };
    return a.planId !== 0 && a.paidThrough <= now;
  });
}

async function main() {
  const key = process.env.KEEPER_PRIVATE_KEY;
  if (!key) throw new Error("missing KEEPER_PRIVATE_KEY");
  const account = privateKeyToAccount(key as `0x${string}`);
  const wallet = createWalletClient({ account, chain: config.chain, transport: http(config.rpcUrl) });

  const known = await findKnownSubscribers();
  const due = await findDueForSettlement(known);
  console.log(`[keeper] ${known.length} known subscribers, ${due.length} due for settlement`);

  for (let i = 0; i < due.length; i += SETTLE_BATCH) {
    const batch = due.slice(i, i + SETTLE_BATCH);
    const hash = await wallet.writeContract({
      address: config.billingAddress,
      abi: billingAbi,
      functionName: "settleMany",
      args: [batch],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[keeper] settled ${batch.length} accounts in ${hash}`);
  }

  const revenue = await publicClient.readContract({
    address: config.billingAddress,
    abi: billingAbi,
    functionName: "withdrawableRevenue",
  });

  // Only sweep when it is worth more than the gas to sweep it. On Base this is a
  // fraction of a cent, but the check keeps a dust-sized balance from burning gas
  // on every single run.
  const MIN_SWEEP = 1_000_000n; // $1.00
  if (revenue >= MIN_SWEEP) {
    const hash = await wallet.writeContract({
      address: config.billingAddress,
      abi: billingAbi,
      functionName: "withdrawRevenue",
      args: [revenue],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[keeper] swept ${Number(revenue) / 1e6} USDC to payout in ${hash}`);
  } else {
    console.log(`[keeper] revenue ${Number(revenue) / 1e6} USDC below sweep threshold`);
  }

  // Solvency spot-check. This should never fire; if it does, stop and investigate
  // before touching anything else.
  const [customers, escrowed, earned] = await publicClient.multicall({
    contracts: (["totalCustomerBalance", "totalEscrowed", "withdrawableRevenue"] as const).map(
      (fn) => ({ address: config.billingAddress, abi: billingAbi, functionName: fn }),
    ),
    allowFailure: false,
  });
  console.log(
    `[keeper] obligations: customers=${Number(customers) / 1e6} escrow=${Number(escrowed) / 1e6} unswept=${Number(earned) / 1e6}`,
  );
}

main().catch((err) => {
  console.error("[keeper] failed", err);
  process.exit(1);
});
