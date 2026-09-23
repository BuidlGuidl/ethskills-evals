import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';
import { getFeeConfig, GasSpikeError } from './fees.js';

/**
 * Batched ERC-20 relayer for Base.
 *
 * Usage:
 *   node src/relayer.js payments.json            # dry run (default)
 *   node src/relayer.js payments.json --send     # broadcast
 *
 * payments.json: [{ "to": "0x...", "amount": "1000000" }, ...]  (amount in token base units)
 *
 * Env:
 *   BASE_RPC_URL            (default https://mainnet.base.org)
 *   RELAYER_PRIVATE_KEY     required for --send
 *   TOKEN_ADDRESS           ERC-20 to send (e.g. USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
 *   BATCH_CONTRACT_ADDRESS  deployed BatchTransfer (must have max approval from relayer)
 *   BATCH_SIZE              payments per tx (default 25)
 */

const batchAbi = parseAbi(['function batchTransfer(address token, address[] tos, uint256[] amounts)']);
const erc20Abi = parseAbi(['function allowance(address owner, address spender) view returns (uint256)']);

const RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 25);
const SPIKE_RETRIES = 10;
const SPIKE_BACKOFF_MS = 30_000;

// Fee policy overrides (see src/fees.js for defaults tuned to Base).
const FEE_POLICY = Object.fromEntries(
  Object.entries({
    maxBaseFeeGwei: process.env.MAX_BASE_FEE_GWEI,
    maxFeeCapGwei: process.env.MAX_FEE_CAP_GWEI,
    minPriorityGwei: process.env.MIN_PRIORITY_GWEI,
    maxPriorityGwei: process.env.MAX_PRIORITY_GWEI,
  }).filter(([, v]) => v !== undefined),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  const send = flags.includes('--send');
  if (!file) {
    console.error('usage: node src/relayer.js payments.json [--send]');
    process.exit(1);
  }
  const token = process.env.TOKEN_ADDRESS;
  const batchContract = process.env.BATCH_CONTRACT_ADDRESS;
  if (!token || !batchContract) {
    console.error('Set TOKEN_ADDRESS and BATCH_CONTRACT_ADDRESS');
    process.exit(1);
  }

  const payments = JSON.parse(readFileSync(file, 'utf8'));
  const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

  let walletClient = null;
  let relayer = null;
  if (send) {
    if (!process.env.RELAYER_PRIVATE_KEY) {
      console.error('RELAYER_PRIVATE_KEY required for --send');
      process.exit(1);
    }
    const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY);
    relayer = account.address;
    walletClient = createWalletClient({ account, chain: base, transport: http(RPC) });

    const allowance = await publicClient.readContract({
      address: token, abi: erc20Abi, functionName: 'allowance', args: [relayer, batchContract],
    });
    const total = payments.reduce((s, p) => s + BigInt(p.amount), 0n);
    if (allowance < total) {
      console.error(`Allowance ${allowance} < batch total ${total}. Approve ${batchContract} on ${token} first (one-time, type(uint256).max).`);
      process.exit(1);
    }
  }

  const chunks = [];
  for (let i = 0; i < payments.length; i += BATCH_SIZE) chunks.push(payments.slice(i, i + BATCH_SIZE));
  console.log(`${payments.length} payments in ${chunks.length} batches of <= ${BATCH_SIZE} (${send ? 'SEND' : 'DRY RUN'})`);

  let totalCostWei = 0n;
  let totalGas = 0n;

  for (let i = 0; i < chunks.length; i++) {
    const tos = chunks[i].map((p) => p.to);
    const amounts = chunks[i].map((p) => BigInt(p.amount));

    // Spike guard: wait out fee spikes instead of sending into them.
    let fees = null;
    for (let attempt = 0; attempt <= SPIKE_RETRIES; attempt++) {
      try {
        fees = await getFeeConfig(publicClient, FEE_POLICY);
        break;
      } catch (e) {
        if (!(e instanceof GasSpikeError)) throw e;
        if (attempt === SPIKE_RETRIES) throw new Error(`Still spiking after ${SPIKE_RETRIES} retries — aborting batch ${i}`);
        console.log(`batch ${i}: ${e.message}; retrying in ${SPIKE_BACKOFF_MS / 1000}s`);
        await sleep(SPIKE_BACKOFF_MS);
      }
    }

    const call = { address: batchContract, abi: batchAbi, functionName: 'batchTransfer', args: [token, tos, amounts] };
    let gasEstimate;
    try {
      // In dry-run without RELAYER_PRIVATE_KEY, set RELAYER_ADDRESS to simulate from the real wallet.
      const account = relayer ?? process.env.RELAYER_ADDRESS;
      if (!account) throw new Error('no account');
      gasEstimate = await publicClient.estimateContractGas({ ...call, account });
    } catch {
      // Can't simulate (no funded sender) — fall back to measured constants:
      // ~23k gas/payment (fresh-address worst case) + tx overhead. See test/BatchTransfer.t.sol.
      gasEstimate = 30_000n + 23_000n * BigInt(tos.length);
    }

    if (!send) {
      const estCostWei = gasEstimate * fees.maxFeePerGas;
      console.log(`batch ${i}: ${tos.length} payments, ~${gasEstimate} gas, max cost ${formatEther(estCostWei)} ETH`);
      totalGas += gasEstimate;
      totalCostWei += estCostWei;
      continue;
    }

    const hash = await walletClient.writeContract({ ...call, gas: (gasEstimate * 12n) / 10n, ...fees });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const l1Fee = receipt.l1Fee ?? 0n;
    const costWei = receipt.gasUsed * receipt.effectiveGasPrice + l1Fee;
    totalGas += receipt.gasUsed;
    totalCostWei += costWei;
    console.log(`batch ${i}: ${hash} status=${receipt.status} gas=${receipt.gasUsed} l1Fee=${formatEther(l1Fee)} ETH cost=${formatEther(costWei)} ETH`);
    if (receipt.status !== 'success') throw new Error(`batch ${i} reverted — isolate the bad recipient and rerun the rest`);
  }

  console.log(`\nTotal: ${totalGas} gas, ${formatEther(totalCostWei)} ETH ${send ? 'spent' : '(worst-case estimate)'}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
