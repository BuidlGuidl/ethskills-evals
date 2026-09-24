#!/usr/bin/env node
import {
  formatEth,
  formatUsd,
  jsonWithBigInts,
  latestBlock,
  normalizeAddress,
  summarizeRelayerGas,
} from "../src/baseGas.mjs";

const url = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const relayer = process.env.RELAYER_ADDRESS;
const ethUsd = Number(process.env.ETH_USD || "NaN");
const tokens = (process.env.TOKEN_ADDRESSES || "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean)
  .map(normalizeAddress);
const chunkSpan = BigInt(process.env.MAX_BLOCK_SPAN || "2000");

if (!relayer) {
  console.error("Set RELAYER_ADDRESS=0x... before running this report.");
  process.exit(1);
}

const endBlock = process.env.END_BLOCK ? BigInt(process.env.END_BLOCK) : await latestBlock(url);
const startBlock = process.env.START_BLOCK
  ? BigInt(process.env.START_BLOCK)
  : endBlock - BigInt(process.env.BLOCKS || "43200");

const summary = await summarizeRelayerGas({
  url,
  relayer,
  fromBlock: startBlock,
  toBlock: endBlock,
  tokens,
  chunkSpan,
});

const averageWei = summary.relayerTxs > 0 ? summary.totalWei / BigInt(summary.relayerTxs) : 0n;
const output = {
  ...summary,
  totalEth: formatEth(summary.totalWei, 12),
  executionEth: formatEth(summary.executionWei, 12),
  l1DataEth: formatEth(summary.l1DataWei, 12),
  averageEthPerRelayerTx: formatEth(averageWei, 12),
  totalUsd: formatUsd(summary.totalWei, ethUsd),
  averageUsdPerRelayerTx: formatUsd(averageWei, ethUsd),
  ethUsd: Number.isFinite(ethUsd) ? ethUsd : null,
};

console.log(jsonWithBigInts(output));
