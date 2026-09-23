// relay.mjs — production relayer for high-volume ERC-20 payments on Base.
//
// Implements the shippable items from PLAN.md:
//   1. Batching via BatchTransfer.sol (amortizes 21k intrinsic + L1 envelope)
//   2. EIP-1559 fields derived from the chain at submission time — never
//      hardcoded, never a ported mainnet tip constant
//   3. Base-fee spike gate: non-urgent batches wait out fee spikes
//   4. Receipt-based cost accounting (incl. OP-stack l1Fee) to CSV
//
// Commands:
//   node src/relay.mjs deploy
//   node src/relay.mjs approve <token>
//   node src/relay.mjs run payments.csv [--dry-run]
//       payments.csv lines: tokenAddress,toAddress,amount(raw units)
//
// Env: RELAYER_PRIVATE_KEY (required), BASE_RPC_URL, BATCH_CONTRACT,
//      BASE_FEE_GATE_GWEI (default 0.05), BATCH_MAX_SIZE (default 50),
//      BATCH_MAX_WAIT_MS (default 5000), COST_LOG (default cost-log.csv)
import { createPublicClient, createWalletClient, http, parseAbi, formatEther, formatGwei } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- config ---------------------------------------------------------------
const RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const GATE_GWEI = Number(process.env.BASE_FEE_GATE_GWEI ?? '0.05');
const BATCH_MAX_SIZE = Number(process.env.BATCH_MAX_SIZE ?? '50');
const BATCH_MAX_WAIT_MS = Number(process.env.BATCH_MAX_WAIT_MS ?? '5000');
const COST_LOG = process.env.COST_LOG ?? join(__dirname, '..', 'cost-log.csv');

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);
const batchAbi = parseAbi([
  'function batchTransfer(address token, address[] recipients, uint256[] amounts)',
]);

if (!existsSync(COST_LOG)) {
  writeFileSync(COST_LOG, 'timestamp,txHash,transfers,gasUsed,effectiveGasPriceGwei,l1FeeWei,totalCostEth\n');
}

// ---- chain helpers ----------------------------------------------------------
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

/// EIP-1559 fields derived immediately before submission (PLAN.md item 2).
/// maxFee = 2x current base fee + tip; tip = p25 of the last 30 blocks.
/// The 2x headroom absorbs base-fee rises while the tx is pending; only
/// baseFee + tip is ever actually paid.
async function deriveFees() {
  const [block, history] = await Promise.all([
    publicClient.getBlock({ blockTag: 'pending' }),
    publicClient.request({ method: 'eth_feeHistory', params: ['0x1e', 'latest', [25]] }),
  ]);
  const baseFee = block.baseFeePerGas;
  const tips = history.reward.map((r) => BigInt(r[0])).sort((a, b) => (a < b ? -1 : 1));
  const tip = tips[Math.floor(tips.length / 2)];
  return { baseFee, maxPriorityFeePerGas: tip, maxFeePerGas: baseFee * 2n + tip };
}

/// Spike gate (PLAN.md item 3): hold non-urgent sends while base fee is high.
async function waitForCalmFees() {
  for (;;) {
    const { baseFee } = await deriveFees();
    if (Number(baseFee) / 1e9 <= GATE_GWEI) return;
    const waitMs = 10_000;
    console.log(`[gate] base fee ${formatGwei(baseFee)} gwei > ${GATE_GWEI} gwei gate; waiting ${waitMs / 1000}s`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

/// Append one line per confirmed tx (PLAN.md item 4: receipt truth, incl. l1Fee).
function logCost(receipt, transfers) {
  const l1Fee = BigInt(receipt.l1Fee ?? 0);
  const totalWei = receipt.gasUsed * receipt.effectiveGasPrice + l1Fee;
  const line = [
    new Date().toISOString(),
    receipt.transactionHash,
    transfers,
    receipt.gasUsed.toString(),
    (Number(receipt.effectiveGasPrice) / 1e9).toFixed(6),
    l1Fee.toString(),
    formatEther(totalWei),
  ].join(',');
  appendFileSync(COST_LOG, line + '\n');
}

// ---- batching loop -----------------------------------------------------------
/// Groups queued payments by token, flushes a group when it hits
/// BATCH_MAX_SIZE or the oldest item has waited BATCH_MAX_WAIT_MS.
export function createBatcher(onFlush) {
  const queues = new Map(); // token -> [{to, amount, enqueuedAt}]
  const timers = new Map();

  async function flush(token) {
    const items = queues.get(token) ?? [];
    if (items.length === 0) return;
    queues.set(token, []);
    clearTimeout(timers.get(token));
    await onFlush(token, items);
  }

  return {
    enqueue(token, to, amount) {
      const q = queues.get(token) ?? [];
      q.push({ to, amount, enqueuedAt: Date.now() });
      queues.set(token, q);
      if (q.length >= BATCH_MAX_SIZE) return flush(token);
      if (!timers.has(token)) {
        timers.set(token, setTimeout(() => { timers.delete(token); flush(token); }, BATCH_MAX_WAIT_MS));
      }
    },
    async drain() {
      for (const token of [...queues.keys()]) await flush(token);
    },
  };
}

// ---- commands -----------------------------------------------------------------
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error('RELAYER_PRIVATE_KEY is required');
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });
  console.log(`relayer: ${account.address}`);

  if (cmd === 'deploy') {
    const artifact = JSON.parse(readFileSync(join(__dirname, '..', 'out/BatchTransfer.sol/BatchTransfer.json'), 'utf8'));
    const { maxFeePerGas, maxPriorityFeePerGas } = await deriveFees();
    const hash = await wallet.deployContract({
      abi: batchAbi,
      bytecode: artifact.bytecode.object,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`BatchTransfer deployed at ${receipt.contractAddress}`);
    console.log(`set BATCH_CONTRACT=${receipt.contractAddress}`);
    logCost(receipt, 0);
    return;
  }

  if (cmd === 'approve') {
    const token = rest[0];
    const spender = process.env.BATCH_CONTRACT;
    if (!spender) throw new Error('BATCH_CONTRACT is required');
    const current = await publicClient.readContract({
      address: token, abi: erc20Abi, functionName: 'allowance', args: [account.address, spender],
    });
    if (current > 0n) {
      console.log(`allowance already ${current}; skipping`);
      return;
    }
    const { maxFeePerGas, maxPriorityFeePerGas } = await deriveFees();
    const hash = await wallet.writeContract({
      address: token, abi: erc20Abi, functionName: 'approve',
      args: [spender, 2n ** 256n - 1n], // one-time max approval; transferFrom then skips the allowance SSTORE
      maxFeePerGas, maxPriorityFeePerGas,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`approved ${token} -> ${spender} in ${hash}`);
    logCost(receipt, 0);
    return;
  }

  if (cmd === 'run') {
    const file = rest[0];
    const dryRun = rest.includes('--dry-run');
    const spender = process.env.BATCH_CONTRACT;
    if (!spender && !dryRun) throw new Error('BATCH_CONTRACT is required (or use --dry-run)');

    const lines = (await readFile(file, 'utf8')).trim().split('\n').filter((l) => l && !l.startsWith('#'));
    const payments = lines.map((l) => {
      const [token, to, amount] = l.split(',').map((s) => s.trim());
      return { token, to, amount: BigInt(amount) };
    });
    console.log(`${payments.length} payments loaded${dryRun ? ' (dry run)' : ''}`);

    const sent = [];
    const batcher = createBatcher(async (token, items) => {
      if (dryRun) {
        console.log(`[dry-run] batch ${token}: ${items.length} transfers`);
        return;
      }
      await waitForCalmFees();
      const { maxFeePerGas, maxPriorityFeePerGas } = await deriveFees();
      const hash = await wallet.writeContract({
        address: spender,
        abi: batchAbi,
        functionName: 'batchTransfer',
        args: [token, items.map((i) => i.to), items.map((i) => i.amount)],
        maxFeePerGas,
        maxPriorityFeePerGas,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error(`batch reverted: ${hash}`);
      logCost(receipt, items.length);
      sent.push({ hash, n: items.length, gasUsed: receipt.gasUsed });
      console.log(`[sent] ${hash} — ${items.length} transfers, ${receipt.gasUsed} gas (${receipt.gasUsed / BigInt(items.length)}/transfer)`);
    });

    for (const p of payments) await batcher.enqueue(p.token, p.to, p.amount);
    await batcher.drain();

    if (sent.length) {
      const totalGas = sent.reduce((a, s) => a + s.gasUsed, 0n);
      const totalTx = sent.reduce((a, s) => a + s.n, 0);
      console.log(`done: ${totalTx} transfers in ${sent.length} txs, ${totalGas} gas, ${totalGas / BigInt(totalTx)} gas/transfer`);
      console.log(`cost detail appended to ${COST_LOG}`);
    }
    return;
  }

  console.log('usage: relay.mjs deploy | approve <token> | run <payments.csv> [--dry-run]');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
