#!/usr/bin/env node
// Gas cost model for the relayer: 40k ERC-20 transfers/day on Base.
//
// Reproduces every number in PLAN.md. All parameters are overridable:
//   node js/cost-model.js                      # defaults (assumptions printed)
//   node js/cost-model.js --set currentTipGwei=1.5 --set l1FeeGweiPerByte=30
//   node js/cost-model.js --rpc https://mainnet.base.org   # live base fee + tip
//
// Measure YOUR actual paid tip from receipts (effectiveGasPrice - baseFee) and
// plug it in via currentTipGwei — it is the single most sensitive input.

const GWEI = 1e9;

const P = {
  transfersPerDay: 40_000,
  ethUsd: 3_300,

  // L2 conditions (Base mainnet)
  l2BaseFeeGwei: 0.005, // typical; spikes to 0.05+ in congestion
  currentTipGwei: 0.1, // common wallet/library default tip on Base
  targetTipGwei: 0.001, // FCFS sequencer needs ~no tip
  maxFeeCapGwei: 2,

  // Execution gas per token transfer (marginal). Measured on the batch
  // contract with a fresh-recipient mock: 1,303,818 gas / 50 = 26,076.
  // Real tokens (proxy, fee logic) cost more, but the SAME work is done
  // standalone vs batched, so it cancels out of the savings estimate.
  execGasPerTransfer: 26_076,

  // L1 data fee (Ecotone): charged per signed-tx byte. Default implies
  // ~1.5e12 wei (~$0.005) for a 110-byte standalone transfer — moderate
  // L1 conditions. It swings ~10x with L1 congestion.
  l1FeeGweiPerByte: 13.6,

  batchSize: 50,

  // Scheduling lever: fraction of volume that is delay-tolerant, and the
  // L2 fee reduction achieved by moving it to low-fee windows.
  schedulableFraction: 0.5,
  scheduleFeeReduction: 0.4,
};

// ---- byte accounting helpers ----
const INTRINSIC = 21_000;
const calldataGas = (nonzero, zero) => nonzero * 16 + zero * 4;

// Standalone transfer(): 4B selector + address word + amount word.
// ~20+8 nonzero bytes of args, rest zero padding; ~110 bytes signed on-chain.
const SOLO = {
  calldata: calldataGas(32, 36),
  signedBytes: 110,
};

// batchPacked: 4B selector + token word + offset/length + 32B/transfer,
// each word = 20B address + 12B amount (~8 nonzero). ~142 + 32B signed.
function packedBatch(B) {
  const nonzero = 24 + 28 * B;
  const zero = 76 + 4 * B;
  return { calldata: calldataGas(nonzero, zero), signedBytes: 142 + 32 * B };
}

const weiPerTx = (gas, feeGwei, l1Bytes, p) =>
  gas * feeGwei * GWEI + l1Bytes * p.l1FeeGweiPerByte * GWEI;

function scenarios(p) {
  const E = p.execGasPerTransfer;
  const B = p.batchSize;
  const pk = packedBatch(B);

  const solo = (tipGwei) => {
    const gas = INTRINSIC + SOLO.calldata + E;
    return weiPerTx(gas, p.l2BaseFeeGwei + tipGwei, SOLO.signedBytes, p);
  };

  // Batched: per-transfer share of intrinsic + calldata + L1 bytes.
  const batched = (tipGwei) => {
    const fee = p.l2BaseFeeGwei + tipGwei;
    const perTransferGas = E + (INTRINSIC + pk.calldata) / B;
    const perTransferL1 = pk.signedBytes / B;
    return weiPerTx(perTransferGas, fee, perTransferL1, p);
  };

  return { solo, batched };
}

function fmt(wei, p) {
  const eth = wei / 1e18;
  return `${eth.toFixed(6)} ETH ($${(eth * p.ethUsd).toFixed(0)})`;
}

async function main() {
  const args = process.argv.slice(2);
  let rpcUrl = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--set") {
      const [k, v] = args[++i].split("=");
      if (!(k in P)) throw new Error(`unknown param: ${k}`);
      P[k] = Number(v);
    } else if (args[i] === "--rpc") {
      rpcUrl = args[++i];
    }
  }

  if (rpcUrl) {
    const { getFees } = require("./fees");
    const fees = await getFees(rpcUrl);
    // getFees returns clamped values; also read raw conditions for the model
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }),
    }).then((r) => r.json());
    P.l2BaseFeeGwei = Number(BigInt(res.result.baseFeePerGas)) / GWEI;
    P.currentTipGwei = Number(fees.maxPriorityFeePerGas) / GWEI; // what the node suggests
    console.log(`live: baseFee=${P.l2BaseFeeGwei.toFixed(6)} gwei, node-suggested tip=${P.currentTipGwei} gwei\n`);
  }

  const { solo, batched } = scenarios(P);
  const n = P.transfersPerDay;

  const baseline = solo(P.currentTipGwei);
  const leverTip = solo(P.targetTipGwei);
  const leverBatch = batched(P.targetTipGwei); // batching on top of tip fix
  const batchOnly = batched(P.currentTipGwei); // batching at today's tip (for attribution)

  // Scheduling applies to the L2-fee portion of the post-lever-1+2 cost.
  const E = P.execGasPerTransfer;
  const pk = packedBatch(P.batchSize);
  const batchedL2Gas = E + (INTRINSIC + pk.calldata) / P.batchSize;
  const schedDaily =
    n * P.schedulableFraction * batchedL2Gas * P.l2BaseFeeGwei * GWEI * P.scheduleFeeReduction;

  const levers = [
    { name: "1. Priority-fee control (fees.js)", dailyWei: (baseline - leverTip) * n },
    { name: "2. Packed batching (BatchTransfer.sol)", dailyWei: (leverTip - leverBatch) * n },
    { name: "   2a. ...of which batching alone at today's tip", dailyWei: (baseline - batchOnly) * n },
    { name: "3. Fee-window scheduling (ops)", dailyWei: schedDaily },
  ];

  console.log("=== ASSUMPTIONS ===");
  for (const [k, v] of Object.entries(P)) console.log(`  ${k} = ${v}`);
  console.log(`  solo calldata gas = ${SOLO.calldata}, packed batch size = ${P.batchSize}`);

  console.log("\n=== COST PER TRANSFER (wei) ===");
  console.log(`  baseline (standalone, ${P.currentTipGwei} gwei tip): ${Math.round(baseline)}`);
  console.log(`  + tip fix (${P.targetTipGwei} gwei):              ${Math.round(leverTip)}`);
  console.log(`  + packed batching x${P.batchSize}:                    ${Math.round(leverBatch)}`);

  console.log("\n=== DAILY TOTAL (${transfersPerDay} transfers) ===".replace("${transfersPerDay}", P.transfersPerDay));
  console.log(`  current:  ${fmt(baseline * n, P)}`);
  console.log(`  after 1:  ${fmt(leverTip * n, P)}`);
  console.log(`  after 1+2:${fmt(leverBatch * n, P)}`);

  console.log("\n=== LEVERS RANKED BY DAILY SAVINGS ===");
  for (const l of levers.slice().sort((a, b) => b.dailyWei - a.dailyWei)) {
    console.log(`  ${l.name}: ${fmt(l.dailyWei, P)}/day`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
