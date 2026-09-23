import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  hexToBigInt,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const CELO_CHAIN_ID = 42220;
const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as const;
const USDC_FEE_CURRENCY_ADDRESS =
  "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B" as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type Recipient = {
  line: number;
  address: Address;
  amountText: string;
  amount: bigint;
};

type Options = {
  csvPath: string;
  execute: boolean;
  feeCurrency?: Address;
};

function usage(): never {
  throw new Error(
    [
      "Usage: npm run payout -- --csv recipients.csv [--execute] [--fee-currency usdc|0x...]",
      "",
      "CSV columns: address,amount",
      "Required env: OPS_PRIVATE_KEY",
      "Optional env: CELO_RPC_URL",
    ].join("\n"),
  );
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseOptions(): Options {
  const csvPath = getArg("--csv") ?? getArg("-c");
  if (!csvPath) usage();

  const feeCurrencyArg = getArg("--fee-currency");
  let feeCurrency: Address | undefined;
  if (feeCurrencyArg) {
    if (feeCurrencyArg.toLowerCase() === "usdc") {
      feeCurrency = USDC_FEE_CURRENCY_ADDRESS;
    } else if (isAddress(feeCurrencyArg)) {
      feeCurrency = feeCurrencyArg;
    } else {
      throw new Error("--fee-currency must be 'usdc' or a valid address");
    }
  }

  return {
    csvPath: resolve(csvPath),
    execute: process.argv.includes("--execute"),
    feeCurrency,
  };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  if (inQuotes) throw new Error(`Unclosed quote in CSV line: ${line}`);
  cells.push(cell.trim());
  return cells;
}

function parseAmount(value: string, decimals: number, line: number): bigint {
  const amount = value.trim();
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) {
    throw new Error(`Line ${line}: invalid decimal amount "${value}"`);
  }

  const [, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      `Line ${line}: amount has more than ${decimals} USDC decimals`,
    );
  }

  const parsed = parseUnits(amount, decimals);
  if (parsed <= 0n) throw new Error(`Line ${line}: amount must be greater than 0`);
  return parsed;
}

function parseCsv(path: string, decimals: number): Recipient[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((line) => line.trim() !== "");
  if (headerLineIndex === -1) throw new Error("CSV is empty");

  const header = splitCsvLine(lines[headerLineIndex]).map((cell) =>
    cell.toLowerCase(),
  );
  const addressIndex = header.findIndex((cell) =>
    ["address", "recipient", "to"].includes(cell),
  );
  const amountIndex = header.findIndex((cell) =>
    ["amount", "amount_usdc", "usdc"].includes(cell),
  );

  if (addressIndex === -1 || amountIndex === -1) {
    throw new Error("CSV header must include address and amount columns");
  }

  const recipients: Recipient[] = [];
  for (let index = headerLineIndex + 1; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim()) continue;

    const line = index + 1;
    const cells = splitCsvLine(raw);
    const addressText = cells[addressIndex];
    const amountText = cells[amountIndex];

    if (!isAddress(addressText)) {
      throw new Error(`Line ${line}: invalid recipient address "${addressText}"`);
    }

    recipients.push({
      line,
      address: addressText,
      amountText,
      amount: parseAmount(amountText, decimals, line),
    });
  }

  if (recipients.length === 0) throw new Error("CSV has no recipients");
  return recipients;
}

function getPrivateKey(): Hex {
  const key = process.env.OPS_PRIVATE_KEY;
  if (!key) throw new Error("Missing OPS_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("OPS_PRIVATE_KEY must be a 0x-prefixed 32-byte private key");
  }
  return key as Hex;
}

async function assertCeloMainnet(publicClient: any) {
  const chainId = await publicClient.getChainId();
  if (chainId !== CELO_CHAIN_ID) {
    throw new Error(`Connected RPC is chain ${chainId}, expected Celo ${CELO_CHAIN_ID}`);
  }
}

async function getFeeCurrencyGasPrice(
  publicClient: any,
  feeCurrency?: Address,
) {
  if (!feeCurrency) return {};
  const gasPriceHex = await publicClient.request({
    method: "eth_gasPrice",
    params: [feeCurrency],
  });
  return { feeCurrency, maxFeePerGas: hexToBigInt(gasPriceHex) };
}

async function main() {
  const options = parseOptions();
  const account = privateKeyToAccount(getPrivateKey());
  const transport = http(process.env.CELO_RPC_URL);

  const publicClient = createPublicClient({ chain: celo, transport });
  const walletClient = createWalletClient({ account, chain: celo, transport });

  await assertCeloMainnet(publicClient);

  const decimals = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const recipients = parseCsv(options.csvPath, decimals);
  const total = recipients.reduce((sum, row) => sum + row.amount, 0n);
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Ops wallet: ${account.address}`);
  console.log(`USDC token: ${USDC_ADDRESS}`);
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Total payout: ${formatUnits(total, decimals)} USDC`);
  console.log(`USDC balance: ${formatUnits(balance, decimals)} USDC`);

  if (balance < total) {
    throw new Error(
      `Insufficient USDC: need ${formatUnits(total, decimals)}, have ${formatUnits(
        balance,
        decimals,
      )}`,
    );
  }

  const feeFields = await getFeeCurrencyGasPrice(publicClient, options.feeCurrency);
  if (options.feeCurrency) {
    console.log(`Gas fee currency: ${options.feeCurrency}`);
  } else {
    console.log("Gas fee currency: CELO");
  }

  for (const [index, recipient] of recipients.entries()) {
    const displayAmount = formatUnits(recipient.amount, decimals);
    console.log(
      `[${index + 1}/${recipients.length}] line ${recipient.line}: ${displayAmount} USDC -> ${recipient.address}`,
    );

    const simulation = await publicClient.simulateContract({
      account,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient.address, recipient.amount],
      ...feeFields,
    } as Parameters<typeof publicClient.simulateContract>[0]);

    if (!options.execute) continue;

    const hash = await walletClient.writeContract(simulation.request);
    console.log(`  tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transfer failed in tx ${hash}`);
    }
  }

  if (!options.execute) {
    console.log("Dry run complete. Re-run with --execute to broadcast transfers.");
  } else {
    console.log("Payout complete.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
