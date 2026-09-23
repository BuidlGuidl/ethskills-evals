// cost-report.mjs — what do 40k ERC-20 transfers/day actually cost on Base, right now?
//
// Everything below is measured live at run time; nothing is hardcoded:
//   - L2 execution price: eth_gasPrice + latest base fee + feeHistory tips (Base RPC)
//   - L1 data fee: GasPriceOracle.getL1Fee() on the canonical unsigned tx (Base predeploy)
//   - Reference transfer gas: --gas-used flag, default is a real USDC transfer receipt
//   - ETH/USD: Chainlink ETH/USD on mainnet, Coinbase spot as fallback
//
// Usage: node src/cost-report.mjs [--transfers 40000] [--gas-used 62159]
//        [--batch-gas 20000] [--rpc URL] [--mainnet-rpc URL]
import { createPublicClient, http, parseAbi, serializeTransaction, encodeFunctionData, parseGwei, formatEther } from 'viem';
import { base, mainnet } from 'viem/chains';

// ---- args ---------------------------------------------------------------
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const TRANSFERS_PER_DAY = Number(arg('transfers', '40000'));
// Reference: real Base USDC transfer receipt 0x6bef4e25…cde5, block 51688771.
const GAS_USED_STANDALONE = BigInt(arg('gas-used', '62159'));
// Conservative batched per-transfer cost incl. intrinsic+calldata share.
// forge test measures 11,716 marginal gas on a representative ERC-20; we plan
// against 20,000 to absorb real-token overhead (blacklist checks, cold slots).
const GAS_USED_BATCHED = BigInt(arg('batch-gas', '20000'));
const RPC = arg('rpc', 'https://mainnet.base.org');
const MAINNET_RPC = arg('mainnet-rpc', 'https://ethereum-rpc.publicnode.com');

// ---- constants ----------------------------------------------------------
const GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F';
const oracleAbi = parseAbi(['function getL1Fee(bytes data) view returns (uint256)']);
const chainlinkAbi = parseAbi(['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)']);
const CHAINLINK_ETH_USD = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const erc20Abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

const baseClient = createPublicClient({ chain: base, transport: http(RPC) });
const mainnetClient = createPublicClient({ chain: mainnet, transport: http(MAINNET_RPC) });

// ---- measurements -------------------------------------------------------
const gwei = (wei) => Number(wei) / 1e9;
const usd = (ethAmount, ethUsd) => ethAmount * ethUsd;

const [gasPrice, block, feeHistory] = await Promise.all([
  baseClient.getGasPrice(),
  baseClient.getBlock({ blockTag: 'latest' }),
  baseClient.request({
    method: 'eth_feeHistory',
    params: ['0x1e', 'latest', [25, 50, 75]],
  }),
]);

const baseFee = block.baseFeePerGas;
const rewards = feeHistory.reward.map((r) => r.map((x) => BigInt(x)));
const median = (xs) => [...xs].sort((a, b) => (a < b ? -1 : 1))[Math.floor(xs.length / 2)];
const tipP25 = median(rewards.map((r) => r[0]));
const tipP50 = median(rewards.map((r) => r[1]));
const tipP75 = median(rewards.map((r) => r[2]));

// L1 data fee for one canonical transfer tx (values in the envelope don't
// affect the fee; only byte count/zero-ness matter, and data is realistic).
const transferData = encodeFunctionData({
  abi: erc20Abi,
  functionName: 'transfer',
  args: ['0xd3182c3c2a563c130e297ef026797e187d45a2bb', 5_000_000n],
});
const unsignedTx = serializeTransaction({
  type: 'eip1559',
  chainId: base.id,
  nonce: 0,
  maxPriorityFeePerGas: tipP25,
  maxFeePerGas: baseFee * 2n + tipP25,
  gas: GAS_USED_STANDALONE,
  to: USDC_BASE,
  value: 0n,
  data: transferData,
});
const l1Fee = await baseClient.readContract({
  address: GAS_PRICE_ORACLE,
  abi: oracleAbi,
  functionName: 'getL1Fee',
  args: [unsignedTx],
});

// ETH/USD: Chainlink mainnet, Coinbase fallback.
let ethUsd;
try {
  const [, answer] = await mainnetClient.readContract({
    address: CHAINLINK_ETH_USD,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  });
  ethUsd = Number(answer) / 1e8;
} catch {
  const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
  ethUsd = Number((await res.json()).data.amount);
}

// ---- math -----------------------------------------------------------------
// OP-stack rule: cost = gasUsed * effectiveGasPrice (L2 exec) + l1Fee (L1 data).
// gasPrice already includes the tip — never add a tip on top of it.
function scenario(gasUsed, priceWei, l1) {
  const l2Eth = Number(gasUsed * priceWei) / 1e18;
  const l1Eth = Number(l1) / 1e18;
  const perTx = usd(l2Eth + l1Eth, ethUsd);
  return { l2Eth, l1Eth, perTx, perDay: perTx * TRANSFERS_PER_DAY };
}

const fairPrice = baseFee + tipP25; // what a correctly configured relayer pays now
const rows = {
  standalone: scenario(GAS_USED_STANDALONE, fairPrice, l1Fee),
  batched: scenario(GAS_USED_BATCHED, fairPrice, l1Fee / 2n), // envelope amortized; ~68B calldata/transfer
  overpayExample: scenario(GAS_USED_STANDALONE, fairPrice + tipP75 - tipP25, l1Fee),
};

// ---- output ---------------------------------------------------------------
const f = (x, d = 6) => x.toFixed(d);
console.log(`Base gas cost report — ${new Date().toISOString()}`);
console.log('='.repeat(64));
console.log(`Measured now:  base fee ${gwei(baseFee)} gwei | tips p25/p50/p75 = ${gwei(tipP25)}/${gwei(tipP50)}/${gwei(tipP75)} gwei`);
console.log(`               eth_gasPrice ${gwei(gasPrice)} gwei | fair total ${gwei(fairPrice)} gwei | ETH/USD $${ethUsd.toFixed(2)}`);
console.log(`L1 data fee:   ${formatEther(l1Fee)} ETH/transfer (${((rows.standalone.l1Eth / (rows.standalone.l1Eth + rows.standalone.l2Eth)) * 100).toFixed(2)}% of cost)`);
console.log('-'.repeat(64));
console.log(`Transfers/day: ${TRANSFERS_PER_DAY} | standalone gas/transfer: ${GAS_USED_STANDALONE} | batched: ${GAS_USED_BATCHED}`);
console.log('');
for (const [name, r] of Object.entries({
  'Standalone, fair fee': rows.standalone,
  'Batched, fair fee': rows.batched,
  'Standalone, p75-style tip': rows.overpayExample,
})) {
  console.log(`${name.padEnd(28)} $${f(r.perTx, 6)}/tx   $${r.perDay.toFixed(2)}/day   $${(r.perDay * 365).toFixed(0)}/yr`);
}
console.log('');
console.log(`Batching saves:          $${(rows.standalone.perDay - rows.batched.perDay).toFixed(2)}/day   $${((rows.standalone.perDay - rows.batched.perDay) * 365).toFixed(0)}/yr`);
console.log(`Tip discipline saves:    $${(rows.overpayExample.perDay - rows.standalone.perDay).toFixed(2)}/day   $${((rows.overpayExample.perDay - rows.standalone.perDay) * 365).toFixed(0)}/yr (if currently paying p75-style tips)`);
console.log(`Every 0.01 gwei of unnecessary tip costs $${(usd(Number(GAS_USED_STANDALONE * parseGwei('0.01')) / 1e18, ethUsd) * TRANSFERS_PER_DAY).toFixed(2)}/day at this volume.`);
