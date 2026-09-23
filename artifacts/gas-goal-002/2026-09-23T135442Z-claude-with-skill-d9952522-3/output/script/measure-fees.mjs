/**
 * Re-derives the tip floor in src/relayer/fee-policy.mjs from live Base data.
 *
 * The question it answers is not "what tip does the node suggest" but "what is
 * the smallest tip that actually got included", which is the only number that
 * justifies lowering what we volunteer.
 *
 *   node script/measure-fees.mjs [--blocks 40]
 */
const RPC = process.env.RPC_URL || "https://base.publicnode.com";
const i = process.argv.indexOf("--blocks");
const BLOCKS = i === -1 ? 40 : Number(process.argv[i + 1]);

let id = 1;
const rpc = async (m, p = []) => {
  const r = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method: m, params: p }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${m}: ${JSON.stringify(j.error)}`);
  return j.result;
};

const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];

const head = parseInt(await rpc("eth_blockNumber"), 16);
const utilisation = [], minTips = [], baseFees = [];

for (let b = head - BLOCKS; b < head; b++) {
  const blk = await rpc("eth_getBlockByNumber", ["0x" + b.toString(16), true]);
  await new Promise((r) => setTimeout(r, 120)); // public RPCs rate-limit
  const baseFee = parseInt(blk.baseFeePerGas, 16);
  baseFees.push(baseFee);
  utilisation.push((parseInt(blk.gasUsed, 16) / parseInt(blk.gasLimit, 16)) * 100);

  // 0x7e is the OP-stack system deposit transaction; it pays no fee.
  const tips = blk.transactions
    .filter((t) => t.type !== "0x7e")
    .map((t) => {
      const cap = parseInt(t.maxFeePerGas ?? t.gasPrice, 16);
      const tip = parseInt(t.maxPriorityFeePerGas ?? t.gasPrice, 16);
      return Math.min(tip, cap - baseFee);
    })
    .filter(Number.isFinite);
  if (tips.length) minTips.push(Math.min(...tips));
}

console.log(`Base, last ${BLOCKS} blocks via ${RPC}\n`);
console.log(`base fee wei        p50 ${q(baseFees, 0.5)}  p90 ${q(baseFees, 0.9)}  max ${Math.max(...baseFees)}`);
console.log(`block utilisation   p50 ${q(utilisation, 0.5).toFixed(1)}%  p90 ${q(utilisation, 0.9).toFixed(1)}%  max ${Math.max(...utilisation).toFixed(1)}%`);
console.log(`lowest included tip p50 ${q(minTips, 0.5)} wei  p90 ${q(minTips, 0.9)} wei  max ${Math.max(...minTips)} wei`);

const zero = minTips.filter((t) => t <= 0).length;
console.log(`\nblocks that included a zero-tip transaction: ${zero}/${minTips.length}`);
console.log(`node's eth_maxPriorityFeePerGas suggestion : ${BigInt(await rpc("eth_maxPriorityFeePerGas"))} wei`);
console.log(`\nIf blocks are well below target and zero-tip transactions land, MIN_TIP_WEI`);
console.log(`can stay at its floor; raise it only if inclusion latency regresses.`);
