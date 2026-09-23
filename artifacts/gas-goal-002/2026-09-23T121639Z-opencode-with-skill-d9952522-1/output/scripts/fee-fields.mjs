// Derives EIP-1559 fee fields for Base from live state, immediately before
// submission. Never hardcode or port mainnet priority-fee constants to Base.
//
// Usage:
//   node scripts/fee-fields.mjs
//   node scripts/fee-fields.mjs --margin-pct 15
//   node scripts/fee-fields.mjs --wait-below-gwei 0.01 --poll-seconds 30
//   node scripts/fee-fields.mjs --min-tip-gwei 0.001 --max-tip-gwei 0.01
// Prints one JSON object with wei values; exit code 1 if the wait gate timed out.
import { feeFields } from "./lib/base.mjs";

const args = process.argv.slice(2);
function argNum(name, fallback) {
  const i = args.indexOf("--" + name);
  const v = i === -1 ? fallback : Number(args[i + 1]);
  if (Number.isNaN(v)) throw new Error(`--${name} must be a number`);
  return v;
}

const marginPct = argNum("margin-pct", 15);
const minTipGwei = argNum("min-tip-gwei", 0.001);
const maxTipGwei = argNum("max-tip-gwei", 0.05);
const waitBelowGwei = args.includes("--wait-below-gwei")
  ? argNum("wait-below-gwei", 0.01)
  : null;
const pollSeconds = argNum("poll-seconds", 30);
const maxPolls = argNum("max-polls", 120);

const gweiToWei = (g) => BigInt(Math.round(g * 1e9));

async function fields() {
  const f = await feeFields({ marginPct });
  const suggestedTip = f.suggestedGasPrice > f.baseFeePerGas
    ? f.suggestedGasPrice - f.baseFeePerGas
    : 0n;
  let tip = suggestedTip;
  if (tip < gweiToWei(minTipGwei)) tip = gweiToWei(minTipGwei);
  if (tip > gweiToWei(maxTipGwei)) tip = gweiToWei(maxTipGwei);
  const buffer = (f.baseFeePerGas * BigInt(Math.round(marginPct * 10))) / 1000n;
  return {
    maxFeePerGas: f.baseFeePerGas + buffer + tip,
    maxPriorityFeePerGas: tip,
    baseFeePerGas: f.baseFeePerGas,
    suggestedTip,
  };
}

let out;
if (waitBelowGwei !== null) {
  for (let i = 0; ; i++) {
    out = await fields();
    if (Number(out.baseFeePerGas) / 1e9 <= waitBelowGwei) break;
    if (i >= maxPolls) {
      console.error(
        `base fee never fell below ${waitBelowGwei} gwei within ${maxPolls} polls (${pollSeconds}s apart)`
      );
      process.exit(1);
    }
    process.stderr.write(
      `base fee ${Number(out.baseFeePerGas) / 1e9} gwei > ${waitBelowGwei} gwei threshold, waiting ${pollSeconds}s (${i + 1}/${maxPolls})\n`
    );
    await new Promise((r) => setTimeout(r, pollSeconds * 1000));
  }
} else {
  out = await fields();
}

console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(out).map(([k, v]) => [k, v.toString()]),
    ),
  )
);
