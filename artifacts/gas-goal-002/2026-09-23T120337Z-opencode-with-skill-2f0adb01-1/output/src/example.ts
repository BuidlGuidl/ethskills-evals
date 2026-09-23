import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { PayoutBatcher, type RelayerSigner } from "./payout-batcher.ts";
import { RpcClient, type Hex } from "./rpc.ts";
import { recommendFees } from "./fees.ts";

const GWEI = 1_000_000_000n;
const LIVE_USDC_COLD = 62_147n;
const LIVE_USDC_WARM = 40_271n;
const BATCHED_COLD = 32_017n;
const BATCHED_WARM = 14_883n;

async function ethPriceUsd(): Promise<number> {
  const env = process.env.ETH_PRICE_USD;
  if (env) return Number(env);
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()).ethereum.usd;
  } catch {
    return 0;
  }
}

async function main() {
  const rpcUrls = (process.env.RPC_URL ??
    "https://base-rpc.publicnode.com,https://1rpc.io/base").split(",");
  const rpc = new RpcClient(rpcUrls, 5, 800);
  const multiSender = process.env.MULTI_SENDER as Hex | undefined;
  const relayerAddress = process.env.RELAYER_ADDRESS as Hex | undefined;
  const coldShare = Number(process.env.COLD_SHARE ?? 0.6);
  const transfersPerDay = Number(process.env.TRANSFERS_PER_DAY ?? 40_000);
  const batchSize = Number(process.env.BATCH_SIZE ?? 250);

  const baseFee = await rpc.getBaseFee();
  const fees = recommendFees(baseFee);
  const ethPrice = await ethPriceUsd();
  const gwei = (x: bigint) => Number(x) / 1e9;

  const standaloneBlended = BigInt(
    Math.round(Number(LIVE_USDC_COLD) * coldShare + Number(LIVE_USDC_WARM) * (1 - coldShare))
  );
  const batchedBlended = BigInt(
    Math.round(Number(BATCHED_COLD) * coldShare + Number(BATCHED_WARM) * (1 - coldShare))
  );
  const effGwei = gwei(baseFee) + 0.001;

  const costPer = (gas: bigint, gweiPrice: number) =>
    Number(gas) * gweiPrice * 1e-9 * ethPrice;
  const nowUnbatched = costPer(standaloneBlended, effGwei);
  const nowBatched = costPer(batchedBlended, effGwei);
  const busyUnbatched = costPer(standaloneBlended, 0.03);
  const busyBatched = costPer(batchedBlended, 0.03);

  const per = (x: number) => `$${x.toFixed(6)}`;
  const day = (x: number) => `$${(x * transfersPerDay).toFixed(2)}`;
  const month = (x: number) => `$${(x * transfersPerDay * 30).toFixed(0)}`;

  console.log(`## Projected payout costs at current conditions`);
  console.log();
  console.log(`| | per transfer | per day (${transfersPerDay.toLocaleString()}) | per month |`);
  console.log(`|---|---|---|---|`);
  console.log(`| unbatched (live receipts basis) | ${per(nowUnbatched)} | ${day(nowUnbatched)} | ${month(nowUnbatched)} |`);
  console.log(`| batched (measured MultiSender) | ${per(nowBatched)} | ${day(nowBatched)} | ${month(nowBatched)} |`);
  console.log(`| unbatched @ 0.03 gwei spike | ${per(busyUnbatched)} | ${day(busyUnbatched)} | ${month(busyUnbatched)} |`);
  console.log(`| batched @ 0.03 gwei spike | ${per(busyBatched)} | ${day(busyBatched)} | ${month(busyBatched)} |`);
  console.log();
  console.log(`base fee: ${gwei(baseFee).toFixed(4)} gwei | recommended maxFee: ${gwei(fees.maxFeePerGas).toFixed(4)} gwei | priority: ${gwei(fees.maxPriorityFeePerGas).toFixed(4)} gwei | ETH: $${ethPrice}`);
  console.log(`savings at current prices: ${month(nowUnbatched - nowBatched)}/month`);
  console.log(`batch size: ${batchSize} transfers per tx (cap 500, gas cap 30M)`);

  if (process.env.BROADCAST === "1") {
    if (!multiSender || !process.env.RELAYER_PRIVATE_KEY) {
      console.error("BROADCAST=1 requires MULTI_SENDER and RELAYER_PRIVATE_KEY");
      process.exit(1);
    }
    const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as Hex);
    const wallet = createWalletClient({ account, chain: base, transport: http(rpcUrls[0]) });
    const signer: RelayerSigner = {
      address: account.address,
      sendTransaction: async (tx) => {
        const hash = await wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          gas: tx.gas,
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
          chain: base,
          account,
        });
        return hash as Hex;
      },
    };
    const batcher = new PayoutBatcher({ multiSender, rpc, signer, batchMaxItems: batchSize });
    const sample = (process.env.SAMPLE_PAYOUTS ?? "1").split(",").map((pair) => {
      const [token, recipient, amount] = pair.split(":");
      return { id: `sample-${recipient}`, token, recipient, amount: BigInt(amount) };
    });
    for (const p of sample) batcher.enqueue(p);
    const results = await batcher.flushOnce();
    console.log("broadcast results:", JSON.stringify(results, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
