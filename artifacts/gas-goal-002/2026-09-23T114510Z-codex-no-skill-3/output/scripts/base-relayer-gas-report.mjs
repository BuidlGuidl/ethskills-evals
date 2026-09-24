#!/usr/bin/env node
import { formatEth, formatUsd, weiToEthNumber } from "../src/gasMath.mjs";

const TRANSFER_SELECTOR = "0xa9059cbb";

function readArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function required(value, name) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function toBlockHex(value) {
  if (typeof value === "string" && value.startsWith("0x")) return value;
  return `0x${BigInt(value).toString(16)}`;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function rpc(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
  return body.result;
}

async function rpcBatch(rpcUrl, calls) {
  if (calls.length === 0) return [];
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      calls.map((call, index) => ({
        jsonrpc: "2.0",
        id: index,
        method: call.method,
        params: call.params,
      })),
    ),
  });
  if (!response.ok) throw new Error(`RPC batch HTTP ${response.status}`);
  const body = await response.json();
  const byId = new Map(body.map((item) => [item.id, item]));
  return calls.map((_, index) => {
    const item = byId.get(index);
    if (!item) throw new Error(`Missing RPC batch response ${index}`);
    if (item.error) throw new Error(`RPC batch call ${index}: ${item.error.message}`);
    return item.result;
  });
}

function receiptCost(receipt) {
  const gasUsed = hexToBigInt(receipt.gasUsed);
  const effectiveGasPrice = hexToBigInt(receipt.effectiveGasPrice);
  const l1Fee = hexToBigInt(receipt.l1Fee);
  return {
    gasUsed,
    effectiveGasPrice,
    executionWei: gasUsed * effectiveGasPrice,
    l1FeeWei: l1Fee,
    totalWei: gasUsed * effectiveGasPrice + l1Fee,
  };
}

function summarize(receipts, ethUsd) {
  const summary = {
    transactions: receipts.length,
    successful: 0,
    failed: 0,
    gasUsed: 0n,
    executionWei: 0n,
    l1FeeWei: 0n,
    totalWei: 0n,
  };

  for (const receipt of receipts) {
    const cost = receiptCost(receipt);
    summary.successful += receipt.status === "0x1" ? 1 : 0;
    summary.failed += receipt.status === "0x0" ? 1 : 0;
    summary.gasUsed += cost.gasUsed;
    summary.executionWei += cost.executionWei;
    summary.l1FeeWei += cost.l1FeeWei;
    summary.totalWei += cost.totalWei;
  }

  const eth = weiToEthNumber(summary.totalWei);
  summary.eth = eth;
  summary.usd = eth * ethUsd;
  return summary;
}

function markdownReport({ relayer, rpcUrl, fromBlock, toBlock, transferTxs, allTxs, ethUsd }) {
  const all = summarize(allTxs.map((item) => item.receipt), ethUsd);
  const transfers = summarize(transferTxs.map((item) => item.receipt), ethUsd);
  const annualizedUsd = transfers.usd * 365;
  const annualizedEth = transfers.eth * 365;

  return `# Base Relayer Gas Report

Relayer: \`${relayer}\`
RPC: \`${new URL(rpcUrl).host}\`
Blocks: ${fromBlock} to ${toBlock}

| Scope | Txs | Failed | Gas used | Execution ETH | L1 data ETH | Total ETH | Total USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ERC-20 \`transfer\` calls | ${transfers.transactions} | ${transfers.failed} | ${transfers.gasUsed.toLocaleString("en-US")} | ${formatEth(
    transfers.executionWei,
  )} | ${formatEth(transfers.l1FeeWei)} | ${formatEth(transfers.totalWei)} | ${formatUsd(transfers.usd)} |
| All relayer txs | ${all.transactions} | ${all.failed} | ${all.gasUsed.toLocaleString("en-US")} | ${formatEth(
    all.executionWei,
  )} | ${formatEth(all.l1FeeWei)} | ${formatEth(all.totalWei)} | ${formatUsd(all.usd)} |

Observed transfer run-rate from this window: ${formatEth(transfers.totalWei)} ETH/window, ${annualizedEth.toFixed(
    4,
  )} ETH/year (${formatUsd(annualizedUsd, 0)}/year) if representative.

Notes:
- Total cost is calculated as \`gasUsed * effectiveGasPrice + l1Fee\`.
- Some RPC providers omit OP-stack \`l1Fee\` fields; in that case the L1 data column will be zero.
`;
}

async function main() {
  const args = readArgs(process.argv);
  const rpcUrl = args.rpc ?? process.env.BASE_RPC_URL ?? "https://base-rpc.publicnode.com";
  const relayer = required(args.relayer ?? process.env.RELAYER_ADDRESS, "--relayer or RELAYER_ADDRESS").toLowerCase();
  const token = (args.token ?? process.env.TOKEN_ADDRESS ?? "").toLowerCase();
  const ethUsd = Number(args["eth-usd"] ?? process.env.ETH_USD ?? "2718.95");
  const latest = Number(hexToBigInt(await rpc(rpcUrl, "eth_blockNumber")));
  const toBlock = Number(args["to-block"] ?? process.env.TO_BLOCK ?? latest);
  const blocksBack = Number(args["blocks-back"] ?? process.env.BLOCKS_BACK ?? 43200);
  const fromBlock = Number(args["from-block"] ?? process.env.FROM_BLOCK ?? Math.max(0, toBlock - blocksBack + 1));
  const batchSize = Number(args["batch-size"] ?? process.env.BATCH_SIZE ?? 20);

  if (!Number.isFinite(ethUsd)) throw new Error(`Invalid ETH/USD: ${ethUsd}`);
  if (fromBlock > toBlock) throw new Error("from-block must be <= to-block");

  const blocks = [];
  for (let block = fromBlock; block <= toBlock; block += 1) blocks.push(block);

  const matches = [];
  for (const blockChunk of chunk(blocks, batchSize)) {
    const fullBlocks = await rpcBatch(
      rpcUrl,
      blockChunk.map((block) => ({
        method: "eth_getBlockByNumber",
        params: [toBlockHex(block), true],
      })),
    );

    for (const block of fullBlocks) {
      for (const tx of block?.transactions ?? []) {
        if (tx.from?.toLowerCase() !== relayer) continue;
        if (token && tx.to?.toLowerCase() !== token) continue;
        matches.push(tx);
      }
    }
  }

  const receipts = [];
  for (const txChunk of chunk(matches, 50)) {
    const chunkReceipts = await rpcBatch(
      rpcUrl,
      txChunk.map((tx) => ({
        method: "eth_getTransactionReceipt",
        params: [tx.hash],
      })),
    );
    for (let i = 0; i < txChunk.length; i += 1) {
      receipts.push({ tx: txChunk[i], receipt: chunkReceipts[i] });
    }
  }

  const transferTxs = receipts.filter((item) => item.tx.input?.toLowerCase().startsWith(TRANSFER_SELECTOR));

  if (args.json === "true") {
    const replacer = (_, value) => (typeof value === "bigint" ? value.toString() : value);
    console.log(
      JSON.stringify(
        {
          relayer,
          token: token || null,
          fromBlock,
          toBlock,
          all: summarize(receipts.map((item) => item.receipt), ethUsd),
          transfers: summarize(transferTxs.map((item) => item.receipt), ethUsd),
        },
        replacer,
        2,
      ),
    );
    return;
  }

  console.log(markdownReport({ relayer, rpcUrl, fromBlock, toBlock, transferTxs, allTxs: receipts, ethUsd }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
