#!/usr/bin/env node
/**
 * Relayer payout sender for Base.
 *
 * Batches ERC-20 payments through the BatchTransfer contract and uses
 * Base-appropriate EIP-1559 fees (tiny priority fee, capped maxFee).
 *
 * Usage:
 *   node relayer/send.mjs estimate <payments.json>   # dry-run cost report (no key needed for local anvil)
 *   node relayer/send.mjs send <payments.json>       # broadcast batches (needs PRIVATE_KEY)
 *   node relayer/send.mjs approve                    # one-time: approve batcher for max uint on the token
 *
 * payments.json: [{ "to": "0x...", "amount": "123.45" }, ...]  (amount in token units, e.g. USDC)
 *
 * Env:
 *   RPC_URL            (default http://127.0.0.1:8545)
 *   CHAIN_ID           (default 8453 = Base mainnet; use 31337 for anvil)
 *   TOKEN_ADDRESS      ERC-20 contract
 *   BATCHER_ADDRESS    deployed BatchTransfer contract
 *   PRIVATE_KEY        relayer key (required for sign/send/approve)
 *   BATCH_SIZE         payments per tx (default 50)
 */
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  encodePacked,
  encodeFunctionData,
  formatEther,
} from "viem";
import { base, anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 8453);
const CHAIN = CHAIN_ID === 8453 ? base : { ...anvil, id: CHAIN_ID };
const TOKEN = process.env.TOKEN_ADDRESS;
const BATCHER = process.env.BATCHER_ADDRESS;
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 50);

// Base has a near-zero priority-fee pattern and a 0.005 gwei base-fee floor.
// 0.001 gwei tip is plenty for inclusion; cap maxFee at 2x base fee + tip.
const PRIORITY_FEE = 1_000_000n; // 0.001 gwei

const batcherAbi = parseAbi([
  "function batchTransfer(address token, address from, bytes packed) external",
]);
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

function walletClient() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required for this command");
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  return { account, client: createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) }) };
}

/** Base-appropriate EIP-1559 fees. Never use legacy gasPrice on Base. */
async function feeParams() {
  const block = await publicClient.getBlock();
  const baseFee = block.baseFeePerGas ?? 0n;
  return { maxFeePerGas: baseFee * 2n + PRIORITY_FEE, maxPriorityFeePerGas: PRIORITY_FEE };
}

function packPayments(payments, decimals) {
  return encodePacked(
    payments.flatMap(() => ["address", "uint128"]),
    payments.flatMap((p) => [p.to, parseUnits(p.amount, decimals)])
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadPayments(path) {
  const payments = JSON.parse(readFileSync(path, "utf8"));
  for (const p of payments) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(p.to)) throw new Error(`bad address: ${p.to}`);
    if (isNaN(Number(p.amount)) || Number(p.amount) <= 0) throw new Error(`bad amount: ${p.amount}`);
  }
  return payments;
}

async function estimate(paymentsPath) {
  const payments = await loadPayments(paymentsPath);
  const decimals = await publicClient.readContract({
    address: TOKEN, abi: erc20Abi, functionName: "decimals",
  });
  const batches = chunk(payments, BATCH_SIZE);
  const from = process.env.PRIVATE_KEY
    ? privateKeyToAccount(process.env.PRIVATE_KEY).address
    : "0x000000000000000000000000000000000000dEaD";

  // Cost of the status quo: one tx per payment.
  const perTxGas = await publicClient.estimateGas({
    account: from,
    to: TOKEN,
    data: encodePacked(
      ["bytes4", "address", "uint256"],
      ["0xa9059cbb", payments[0].to, parseUnits(payments[0].amount, decimals)]
    ),
  }).catch(() => 65_000n); // fall back to typical ERC-20 transfer if simulation fails

  // Cost of batching.
  let batchGasTotal = 0n;
  for (const b of batches) {
    batchGasTotal += await publicClient.estimateGas({
      account: from,
      to: BATCHER,
      data: encodeFunctionData({
        abi: batcherAbi,
        functionName: "batchTransfer",
        args: [TOKEN, from, packPayments(b, decimals)],
      }),
    }).catch(() => 30_000n * BigInt(b.length));
  }

  const individualTotal = perTxGas * BigInt(payments.length);
  const { maxFeePerGas } = await feeParams();
  const toUsd = (gas) =>
    `$${((Number(formatEther(gas * maxFeePerGas)) * Number(process.env.ETH_USD ?? 2500))).toFixed(2)}`;

  console.log(`payments:            ${payments.length}`);
  console.log(`batches:             ${batches.length} (max ${BATCH_SIZE}/tx)`);
  console.log(`gas, individual:     ${individualTotal.toLocaleString()} (${perTxGas}/tx)`);
  console.log(`gas, batched:        ${batchGasTotal.toLocaleString()}`);
  console.log(`gas saved:           ${(100 - Number((batchGasTotal * 10000n) / individualTotal) / 100).toFixed(1)}%`);
  console.log(`cost @ ${formatUnits(maxFeePerGas, 9)} gwei max fee:`);
  console.log(`  individual:        ${formatEther(individualTotal * maxFeePerGas)} ETH  (~${toUsd(individualTotal)})`);
  console.log(`  batched:           ${formatEther(batchGasTotal * maxFeePerGas)} ETH  (~${toUsd(batchGasTotal)})`);
}

async function approve() {
  const { account, client } = await walletClient();
  const fees = await feeParams();
  const hash = await client.writeContract({
    address: TOKEN, abi: erc20Abi, functionName: "approve",
    args: [BATCHER, 2n ** 256n - 1n], ...fees,
  });
  console.log(`approve tx: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("confirmed. Max approval set (USDC/OZ tokens skip the allowance write, saving ~5k gas/payment).");
}

async function send(paymentsPath) {
  const { account, client } = await walletClient();
  const payments = await loadPayments(paymentsPath);
  const decimals = await publicClient.readContract({
    address: TOKEN, abi: erc20Abi, functionName: "decimals",
  });
  const batches = chunk(payments, BATCH_SIZE);
  console.log(`sending ${payments.length} payments in ${batches.length} batches from ${account.address}`);

  for (const [i, batch] of batches.entries()) {
    const fees = await feeParams(); // re-read base fee per batch
    const packed = packPayments(batch, decimals);
    const hash = await client.writeContract({
      address: BATCHER, abi: batcherAbi, functionName: "batchTransfer",
      args: [TOKEN, account.address, packed], ...fees,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(
      `batch ${i + 1}/${batches.length}: ${batch.length} payments, ` +
      `${receipt.gasUsed} gas, effective fee ${formatUnits(receipt.effectiveGasPrice, 9)} gwei, tx ${hash}`
    );
  }
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "estimate") await estimate(arg);
  else if (cmd === "send") await send(arg);
  else if (cmd === "approve") await approve();
  else {
    console.error("usage: send.mjs <estimate|send|approve> [payments.json]");
    process.exit(1);
  }
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
