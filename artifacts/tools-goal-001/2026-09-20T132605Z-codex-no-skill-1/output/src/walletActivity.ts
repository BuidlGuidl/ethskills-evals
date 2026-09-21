import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  type Address,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

type SupportedNetwork = "eip155:8453" | "eip155:84532";

type ActivityOptions = {
  network: string;
  rpcUrl?: string;
  lookbackBlocks: number;
};

type TokenTransfer = {
  direction: "in" | "out";
  token: Address;
  counterparty?: Address;
  valueRaw: string;
  blockNumber: string;
  transactionHash: string;
};

export type WalletActivitySummary = {
  wallet: Address;
  network: SupportedNetwork;
  latestBlock: string;
  fromBlock: string;
  lookbackBlocks: number;
  nativeBalanceEth: string;
  totalTransactionCount: number;
  recentTokenTransfers: {
    incoming: number;
    outgoing: number;
    uniqueTokenContracts: number;
    sample: TokenTransfer[];
  };
  summary: string;
};

function getChain(network: string) {
  if (network === "eip155:8453") return base;
  if (network === "eip155:84532") return baseSepolia;

  throw new Error(
    `Unsupported X402_NETWORK "${network}". This foundation supports Base mainnet (eip155:8453) and Base Sepolia (eip155:84532).`,
  );
}

function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) {
    throw new Error(`${label} must be a valid EVM address`);
  }

  return getAddress(value);
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function summarizeWalletActivity(
  walletInput: string,
  options: ActivityOptions,
): Promise<WalletActivitySummary> {
  const wallet = requireAddress(walletInput, "wallet");
  const chain = getChain(options.network);
  const network = options.network as SupportedNetwork;
  const client = createPublicClient({
    chain,
    transport: http(options.rpcUrl),
  });

  const latestBlock = await client.getBlockNumber();
  const lookback = BigInt(Math.max(1, options.lookbackBlocks));
  const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;

  const getTransferLogs = async (direction: "in" | "out") => {
    try {
      return await client.getLogs({
        event: transferEvent,
        args: direction === "in" ? { to: wallet } : { from: wallet },
        fromBlock,
        toBlock: latestBlock,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Base RPC could not scan Transfer logs over ${fromBlock}-${latestBlock}: ${reason}`,
      );
    }
  };

  const [nativeBalance, totalTransactionCount, incomingLogs, outgoingLogs] =
    await Promise.all([
      client.getBalance({ address: wallet }),
      client.getTransactionCount({ address: wallet }),
      getTransferLogs("in"),
      getTransferLogs("out"),
    ]);

  const sample = [
    ...incomingLogs.map((log) => ({
      direction: "in" as const,
      token: log.address,
      counterparty: log.args.from,
      valueRaw: log.args.value?.toString() ?? "0",
      blockNumber: log.blockNumber?.toString() ?? "0",
      transactionHash: log.transactionHash ?? "unknown",
    })),
    ...outgoingLogs.map((log) => ({
      direction: "out" as const,
      token: log.address,
      counterparty: log.args.to,
      valueRaw: log.args.value?.toString() ?? "0",
      blockNumber: log.blockNumber?.toString() ?? "0",
      transactionHash: log.transactionHash ?? "unknown",
    })),
  ]
    .sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)))
    .slice(0, 8);

  const uniqueTokenContracts = new Set(
    [...incomingLogs, ...outgoingLogs].map((log) => log.address.toLowerCase()),
  ).size;

  const summaryParts = [
    `${shortAddress(wallet)} holds ${Number(formatEther(nativeBalance)).toFixed(6)} ETH on ${chain.name}.`,
    `The account has ${totalTransactionCount} total native transactions.`,
    `Across the last ${options.lookbackBlocks} blocks, I found ${incomingLogs.length} incoming and ${outgoingLogs.length} outgoing Transfer events across ${uniqueTokenContracts} token contract(s).`,
  ];

  if (sample[0]) {
    summaryParts.push(
      `Most recent sampled activity is a ${sample[0].direction === "in" ? "received" : "sent"} transfer involving token ${shortAddress(sample[0].token)} in block ${sample[0].blockNumber}.`,
    );
  } else {
    summaryParts.push("No token Transfer events appeared in the scanned block window.");
  }

  return {
    wallet,
    network,
    latestBlock: latestBlock.toString(),
    fromBlock: fromBlock.toString(),
    lookbackBlocks: options.lookbackBlocks,
    nativeBalanceEth: formatEther(nativeBalance),
    totalTransactionCount,
    recentTokenTransfers: {
      incoming: incomingLogs.length,
      outgoing: outgoingLogs.length,
      uniqueTokenContracts,
      sample,
    },
    summary: summaryParts.join(" "),
  };
}
