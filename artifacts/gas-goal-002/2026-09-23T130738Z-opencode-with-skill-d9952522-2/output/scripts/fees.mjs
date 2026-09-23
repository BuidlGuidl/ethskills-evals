#!/usr/bin/env node
const DEFAULT_RPC = "https://mainnet.base.org";
const SEND_SELECTOR = "0xd573bd2f";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const GPO = "0x420000000000000000000000000000000000000f";

const args = process.argv.slice(2);
const cmd = args[0];
const opts = Object.fromEntries(
  args.slice(1).flatMap((a, i, rest) => {
    if (a.startsWith("--")) {
      const v = rest[i + 1];
      return v && !v.startsWith("--") ? [[a.slice(2), v]] : [[a.slice(2), true]];
    }
    return [];
  })
);
const rpc = opts["rpc-url"] || DEFAULT_RPC;

async function call(method, params) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "relayer-fees/1.0" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

const weiToGwei = (wei) => Number(BigInt(wei)) / 1e9;

async function ethUsd() {
  if (opts["eth-usd"]) return Number(opts["eth-usd"]);
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  const json = await res.json();
  return Number(json.data.amount);
}

async function liveFees() {
  const [gasPrice, block, tip] = await Promise.all([
    call("eth_gasPrice", []),
    call("eth_getBlockByNumber", ["latest", false]),
    call("eth_maxPriorityFeePerGas", []).catch(() => null),
  ]);
  const baseFee = BigInt(block.baseFeePerGas);
  const gp = BigInt(gasPrice);
  let priority = tip ? BigInt(tip) : gp > baseFee ? gp - baseFee : 0n;
  if (priority + baseFee > gp && gp > baseFee) priority = gp - baseFee;
  const maxFee = (baseFee * 11n) / 10n + priority;
  return { gasPrice: gp, baseFee, priority, maxFee };
}

async function cmdFields() {
  const { gasPrice, baseFee, priority, maxFee } = await liveFees();
  const hist = await call("eth_feeHistory", [10, "latest", []]);
  const bases = hist.baseFeePerGas.map((b) => BigInt(b)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = bases[bases.length >> 1];
  const spiky = baseFee > median * 5n;
  const out = {
    rpc: rpc,
    chainId: await call("eth_chainId", []),
    baseFeeGwei: weiToGwei(baseFee),
    gasPriceGwei: weiToGwei(gasPrice),
    maxPriorityFeePerGas: "0x" + priority.toString(16),
    maxFeePerGas: "0x" + maxFee.toString(16),
    warning: spiky
      ? `base fee ${weiToGwei(baseFee)} gwei is >5x the 10-block median ${weiToGwei(median)} gwei; consider delaying non-urgent batches`
      : null,
  };
  if (opts.json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`base fee          : ${out.baseFeeGwei} gwei`);
    console.log(`gas price         : ${out.gasPriceGwei} gwei`);
    console.log(`maxPriorityFeePerGas: ${out.maxPriorityFeePerGas} (${weiToGwei(priority)} gwei)`);
    console.log(`maxFeePerGas      : ${out.maxFeePerGas} (${weiToGwei(maxFee)} gwei)`);
    if (out.warning) console.log(`warning           : ${out.warning}`);
  }
}

async function cmdEncode() {
  if (!opts.file) throw new Error("usage: encode --file payments.json [--json]");
  const { readFileSync } = await import("node:fs");
  const payments = JSON.parse(readFileSync(opts.file, "utf8"));
  if (!Array.isArray(payments) || payments.length === 0) throw new Error("payments file must be a non-empty array");
  const words = [];
  for (const p of payments) {
    words.push(padAddress(p.token), padAddress(p.to), toWord(p.amount));
  }
  const data = SEND_SELECTOR + toWord(0x20) + toWord(payments.length) + words.join("");
  const gas = await call("eth_estimateGas", [
    { from: opts.from ?? undefined, to: opts.batcher ?? undefined, data },
  ]).catch((e) => null);
  if (opts.json) console.log(JSON.stringify({ to: opts.batcher, data, estimatedGas: gas && Number(gas) }, null, 2));
  else {
    console.log(`to     : ${opts.batcher}`);
    console.log(`data   : ${data}`);
    console.log(`items  : ${payments.length}`);
    if (gas) console.log(`estGas : ${Number(gas)} (${Math.round(Number(gas) / payments.length)} per transfer)`);
  }
}

function padAddress(a) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`bad address: ${a}`);
  return a.toLowerCase().slice(2).padStart(64, "0");
}
function toWord(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}

async function cmdAudit() {
  if (!opts.address) throw new Error("usage: audit --address 0xRELAYER [--token 0xUSDC] [--blocks 720] [--per-day 40000]");
  const token = (opts.token || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").toLowerCase();
  const window = Number(opts.blocks || 720);
  const perDay = Number(opts["per-day"] || 40000);
  const latest = parseInt(await call("eth_blockNumber", []), 16);
  const logs = await call("eth_getLogs", [
    {
      fromBlock: "0x" + (latest - window).toString(16),
      toBlock: "latest",
      address: token,
      topics: [TRANSFER_TOPIC, "0x" + padAddress(opts.address)],
    },
  ]);
  if (!logs.length) {
    console.log(`no Transfer events from ${opts.address} on ${token} in the last ${window} blocks`);
    return;
  }
  const hashes = [...new Set(logs.map((l) => l.transactionHash))].slice(0, Number(opts["max-txs"] || 100));
  const receipts = [];
  for (const h of hashes) {
    const r = await call("eth_getTransactionReceipt", [h]);
    if (r) receipts.push(r);
    await new Promise((r2) => setTimeout(r2, 60));
  }
  const gasUsed = receipts.map((r) => Number(r.gasUsed));
  const egp = receipts.map((r) => Number(r.effectiveGasPrice));
  const l1 = receipts.map((r) => (r.l1Fee ? Number(r.l1Fee) : 0));
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const avgGas = sum(gasUsed) / receipts.length;
  const avgEgp = sum(egp) / receipts.length;
  const avgL1 = sum(l1) / receipts.length;
  const usd = await ethUsd();
  const current = await liveFees();
  const perTxEth = (avgGas * avgEgp + avgL1) / 1e18;
  const perTxAtMarket = (avgGas * Number(current.gasPrice) + avgL1) / 1e18;
  const marketTx = (avgGas * Number(current.gasPrice)) / 1e18;
  const overpay = avgEgp / Number(current.gasPrice);
  const f = (x) => x.toFixed(4);
  console.log(`sampled ${receipts.length} txs from ${opts.address} (last ${window} blocks)`);
  console.log(`avg gasUsed      : ${Math.round(avgGas)}`);
  console.log(`avg eff gas price: ${f(weiToGwei(BigInt(Math.round(avgEgp))))} gwei`);
  console.log(`avg l1Fee        : ${f(weiToGwei(BigInt(Math.round(avgL1))))} gwei (${f(avgL1 / 1e18 * usd)} usd)`);
  console.log(`market now       : ${f(weiToGwei(current.gasPrice))} gwei  (you pay ${f(overpay)}x market)`);
  console.log(`--- projections at ${perDay} transfers/day, ETH $${usd} ---`);
  console.log(`actual   : $${f(perTxEth * usd * perDay)}/day  ($${(perTxEth * usd * perDay * 365).toFixed(0)}/yr)`);
  console.log(`at market: $${f(perTxAtMarket * usd * perDay)}/day  ($${(perTxAtMarket * usd * perDay * 365).toFixed(0)}/yr)`);
  if (overpay > 1.5)
    console.log(`>>> fee fields look misconfigured: fixing them saves $${f((perTxEth - perTxAtMarket) * usd * perDay)}/day`);
}

async function cmdQuote() {
  if (!opts.gas) throw new Error("usage: quote --gas 45059 [--l1-fee-gwei 3.9] [--per-day 40000]");
  const gas = Number(opts.gas);
  const perDay = Number(opts["per-day"] || 40000);
  const l1Gwei = Number(opts["l1-fee-gwei"] || 0);
  const { gasPrice } = await liveFees();
  const usd = await ethUsd();
  const eth = (gas * weiToGwei(gasPrice) + l1Gwei) / 1e9;
  console.log(
    `$${(eth * usd).toFixed(6)}/tx -> $${(eth * usd * perDay).toFixed(2)}/day -> $${(eth * usd * perDay * 365).toFixed(0)}/yr ` +
      `(gas ${gas} @ ${weiToGwei(gasPrice)} gwei, l1 ${l1Gwei} gwei, ETH $${usd})`
  );
}

const commands = { fields: cmdFields, encode: cmdEncode, audit: cmdAudit, quote: cmdQuote };
if (!commands[cmd]) {
  console.log(`usage: fees.mjs <fields|encode|audit|quote> [options]
  fields: [--json] [--rpc-url URL]
  encode: --file payments.json --batcher 0xADDR [--from 0xRELAYER] [--json]
  audit : --address 0xRELAYER [--token 0xTOKEN] [--blocks N] [--per-day N] [--eth-usd X]
  quote : --gas N [--l1-fee-gwei X] [--per-day N] [--eth-usd X]`);
  process.exit(1);
}
commands[cmd]().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
