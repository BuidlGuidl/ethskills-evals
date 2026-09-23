import { createPublicClient, http, parseAbi, encodeFunctionData, serializeTransaction, formatEther, parseGwei } from 'viem';
import { base } from 'viem/chains';

/**
 * Live cost quote for the payments workload on Base.
 *
 *   node src/quote.js [transfersPerDay]
 *
 * Prints what one ERC-20 transfer costs right now (L2 execution + L1 data fee),
 * what 40k/day costs, and what it would cost batched. Numbers behind PLAN.md.
 *
 * Execution gas constants below were measured with `forge test` (test/BatchTransfer.t.sol)
 * against a USDC-like token. L1 data fees come live from Base's GasPriceOracle.
 */

// Measured execution gas (includes amortized 21,000 intrinsic). See PLAN.md.
const GAS = {
  singleExistingHolder: 54_928n,
  singleFreshAddress: 76_531n,
  batch25ExistingHolder: 12_246n, // per payment
  batch25FreshAddress: 22_506n, // per payment
};

const ORACLE = '0x420000000000000000000000000000000000000F';
const ETH_USD_FEED = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'; // Chainlink on Base
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const oracleAbi = parseAbi(['function getL1Fee(bytes data) view returns (uint256)']);
const feedAbi = parseAbi(['function latestAnswer() view returns (int256)']);
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount)']);
const batchAbi = parseAbi(['function batchTransfer(address token, address[] tos, uint256[] amounts)']);

const RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const client = createPublicClient({ chain: base, transport: http(RPC) });

function sampleTx(data, gas) {
  return serializeTransaction({
    chainId: 8453, nonce: 0, type: 'eip1559',
    maxPriorityFeePerGas: parseGwei('0.001'), maxFeePerGas: parseGwei('0.01'),
    gas, to: USDC, value: 0n, data,
  });
}

const fmtUsd = (wei, ethUsd) => `$${((Number(wei) / 1e18) * ethUsd).toFixed(6)}`;
const fmtUsd2 = (wei, ethUsd) => `$${((Number(wei) / 1e18) * ethUsd).toFixed(2)}`;

async function main() {
  const perDay = BigInt(process.argv[2] ?? 40_000);

  const block = await client.getBlock({ blockTag: 'latest' });
  const baseFee = block.baseFeePerGas;
  let priority = parseGwei('0.001');
  try { priority = await client.estimateMaxPriorityFeePerGas(); } catch {}
  const gasPrice = baseFee + priority;

  const ethUsd = Number(await client.readContract({ address: ETH_USD_FEED, abi: feedAbi, functionName: 'latestAnswer' })) / 1e8;

  // L1 data fee for a single transfer vs a batch of 25 (from the oracle, live).
  const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: ['0x1111111111111111111111111111111111111111', 1_000_000n] });
  const n = 25;
  const batchData = encodeFunctionData({
    abi: batchAbi, functionName: 'batchTransfer',
    args: [USDC, Array(n).fill('0x1111111111111111111111111111111111111111'), Array(n).fill(1_000_000n)],
  });
  const l1Single = await client.readContract({ address: ORACLE, abi: oracleAbi, functionName: 'getL1Fee', args: [sampleTx(transferData, 100_000n)] });
  const l1Batch = await client.readContract({ address: ORACLE, abi: oracleAbi, functionName: 'getL1Fee', args: [sampleTx(batchData, 1_200_000n)] });

  const row = (label, execGas, l1PerPayment) => {
    const exec = execGas * gasPrice;
    const total = exec + l1PerPayment;
    return { label, execGas, exec, l1: l1PerPayment, total };
  };

  const rows = [
    row('single transfer, existing holder', GAS.singleExistingHolder, l1Single),
    row('single transfer, fresh address  ', GAS.singleFreshAddress, l1Single),
    row('batch of 25, existing holder    ', GAS.batch25ExistingHolder, l1Batch / BigInt(n)),
    row('batch of 25, fresh address      ', GAS.batch25FreshAddress, l1Batch / BigInt(n)),
  ];

  console.log(`Base right now: base fee ${Number(baseFee) / 1e9} gwei, priority ${Number(priority) / 1e9} gwei, ETH $${ethUsd.toFixed(0)}`);
  console.log(`Volume: ${perDay} transfers/day\n`);
  for (const r of rows) {
    const daily = r.total * perDay;
    console.log(`${r.label} | exec ${r.execGas} gas (${fmtUsd(r.exec, ethUsd)}) + L1 data ${fmtUsd(r.l1, ethUsd)} = ${fmtUsd(r.total, ethUsd)}/payment`);
    console.log(`    -> ${fmtUsd2(daily, ethUsd)}/day, ${fmtUsd2(daily * 30n, ethUsd)}/month, ${fmtUsd2(daily * 365n, ethUsd)}/year`);
  }
  const saved = rows[0].total - rows[2].total;
  console.log(`\nBatching 25x saves ${(((Number(rows[0].total - rows[2].total)) / Number(rows[0].total)) * 100).toFixed(0)}% on existing-holder payments = ${fmtUsd2(saved * perDay * 365n, ethUsd)}/year at current volume.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
