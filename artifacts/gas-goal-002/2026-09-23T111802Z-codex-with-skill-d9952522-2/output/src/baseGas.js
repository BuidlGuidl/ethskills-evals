const DEFAULT_RPC_URL = "https://mainnet.base.org";
const DEFAULT_ETH_USD_URL = "https://api.coinbase.com/v2/prices/ETH-USD/spot";
const DEFAULT_DAILY_TRANSFERS = 40000;
const DEFAULT_TRANSFER_GAS_USED = 40259n;
const DEFAULT_L1_FEE_WEI = 2873935958n;

export async function rpc(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`RPC ${method} failed: ${body.error.message}`);
  }

  return body.result;
}

export function hexToBigInt(hex) {
  if (typeof hex !== "string" || !hex.startsWith("0x")) {
    throw new Error(`Expected hex quantity, got ${hex}`);
  }
  return BigInt(hex);
}

export async function getEthUsd(url = DEFAULT_ETH_USD_URL) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ETH/USD lookup failed with HTTP ${response.status}`);
  }
  const body = await response.json();
  const amount = Number(body?.data?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("ETH/USD lookup returned an invalid amount");
  }
  return amount;
}

export async function getBaseGasSnapshot({
  rpcUrl = DEFAULT_RPC_URL,
  ethUsdUrl = DEFAULT_ETH_USD_URL,
  receiptHash,
} = {}) {
  const [gasPriceHex, blockHex, ethUsd] = await Promise.all([
    rpc(rpcUrl, "eth_gasPrice"),
    rpc(rpcUrl, "eth_getBlockByNumber", ["latest", false]),
    getEthUsd(ethUsdUrl),
  ]);

  const snapshot = {
    chain: "base",
    measuredAt: new Date().toISOString(),
    blockNumber: Number(hexToBigInt(blockHex.number)),
    gasPriceWei: hexToBigInt(gasPriceHex),
    baseFeePerGasWei: blockHex.baseFeePerGas ? hexToBigInt(blockHex.baseFeePerGas) : null,
    ethUsd,
  };

  if (receiptHash) {
    const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [receiptHash]);
    snapshot.receipt = {
      hash: receipt.transactionHash,
      gasUsed: hexToBigInt(receipt.gasUsed),
      effectiveGasPriceWei: hexToBigInt(receipt.effectiveGasPrice),
      l1FeeWei: receipt.l1Fee ? hexToBigInt(receipt.l1Fee) : 0n,
      l1GasUsed: receipt.l1GasUsed ? hexToBigInt(receipt.l1GasUsed) : null,
    };
  }

  return snapshot;
}

export function costUsd({
  gasUsed = DEFAULT_TRANSFER_GAS_USED,
  gasPriceWei,
  l1FeeWei = DEFAULT_L1_FEE_WEI,
  ethUsd,
}) {
  const executionWei = gasUsed * gasPriceWei;
  const totalWei = executionWei + l1FeeWei;
  const eth = Number(totalWei) / 1e18;
  return {
    gasUsed,
    gasPriceWei,
    l1FeeWei,
    executionWei,
    totalWei,
    eth,
    usd: eth * ethUsd,
  };
}

export function formatCostModel({ snapshot, dailyTransfers = DEFAULT_DAILY_TRANSFERS, gasUsed, l1FeeWei }) {
  const cost = costUsd({
    gasUsed,
    gasPriceWei: snapshot.gasPriceWei,
    l1FeeWei,
    ethUsd: snapshot.ethUsd,
  });
  const perDay = cost.usd * dailyTransfers;
  const perYear = perDay * 365;

  return {
    measuredAt: snapshot.measuredAt,
    blockNumber: snapshot.blockNumber,
    ethUsd: snapshot.ethUsd,
    gasPriceGwei: Number(snapshot.gasPriceWei) / 1e9,
    baseFeeGwei: snapshot.baseFeePerGasWei == null ? null : Number(snapshot.baseFeePerGasWei) / 1e9,
    transferGasUsed: Number(cost.gasUsed),
    l1FeeWei: Number(cost.l1FeeWei),
    perTransferUsd: cost.usd,
    dailyTransfers,
    perDayUsd: perDay,
    perYearUsd: perYear,
  };
}

function parseArgs(argv) {
  const args = {
    rpcUrl: process.env.BASE_RPC_URL || DEFAULT_RPC_URL,
    ethUsdUrl: DEFAULT_ETH_USD_URL,
    dailyTransfers: DEFAULT_DAILY_TRANSFERS,
    gasUsed: DEFAULT_TRANSFER_GAS_USED,
    l1FeeWei: DEFAULT_L1_FEE_WEI,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--rpc-url") {
      args.rpcUrl = next;
      i += 1;
    } else if (arg === "--receipt") {
      args.receiptHash = next;
      i += 1;
    } else if (arg === "--daily-transfers") {
      args.dailyTransfers = Number(next);
      i += 1;
    } else if (arg === "--gas-used") {
      args.gasUsed = BigInt(next);
      i += 1;
    } else if (arg === "--l1-fee-wei") {
      args.l1FeeWei = BigInt(next);
      i += 1;
    } else if (arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node src/baseGas.js [options]

Options:
  --rpc-url <url>           Base RPC URL. Defaults to BASE_RPC_URL or mainnet.base.org.
  --receipt <tx-hash>       Receipt to read gasUsed/l1Fee from.
  --daily-transfers <n>     Daily transfer count. Default: ${DEFAULT_DAILY_TRANSFERS}.
  --gas-used <n>            Override execution gas. Default: ${DEFAULT_TRANSFER_GAS_USED}.
  --l1-fee-wei <n>          Override OP-stack L1 fee. Default: ${DEFAULT_L1_FEE_WEI}.
`);
}

function toJson(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }

    const snapshot = await getBaseGasSnapshot(args);
    const gasUsed = snapshot.receipt?.gasUsed ?? args.gasUsed;
    const l1FeeWei = snapshot.receipt?.l1FeeWei ?? args.l1FeeWei;
    console.log(toJson(formatCostModel({ snapshot, dailyTransfers: args.dailyTransfers, gasUsed, l1FeeWei })));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
