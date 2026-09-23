import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type PublicClient,
  type WalletClient,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { BatchQueue, DEFAULT_BATCHER_CONFIG, GasPriceGate, type BatcherConfig } from "./batcher";

export const DISBURSER_ABI = parseAbi([
  "function disburseFrom(address token, bytes packed, bool strict)",
  "event Disbursed(address indexed token, address indexed caller, uint256 attempted, uint256 succeeded, uint256 amount)",
  "event TransferFailed(address indexed token, uint256 indexed index, address recipient, uint256 amount)",
]);

export type RelayerDeps = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  disburserAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
};

export type BatchReceipt = {
  txHash: `0x${string}`;
  attempted: number;
  succeeded: number;
  failed: { index: number; recipient: string; amount: bigint }[];
};

export class DisburserRelayer {
  readonly queue: BatchQueue;
  private readonly feeGate: GasPriceGate;

  constructor(
    private readonly deps: RelayerDeps,
    config: BatcherConfig = DEFAULT_BATCHER_CONFIG,
    clock: () => number = () => Date.now(),
  ) {
    this.queue = new BatchQueue(config, clock);
    this.feeGate = new GasPriceGate(async () => {
      const gasPrice = await deps.publicClient.getGasPrice();
      return Number(gasPrice) / 1e9;
    }, config.maxEffectiveGasPriceGwei);
  }

  async flushIfDue(): Promise<BatchReceipt | null> {
    if (!this.queue.shouldFlush()) {
      return null;
    }
    if (!(await this.feeGate.isOpen())) {
      return null;
    }
    return this.flush();
  }

  async flush(): Promise<BatchReceipt> {
    const planned = this.queue.drain();
    if (planned === null) {
      throw new Error("nothing queued");
    }
    const { publicClient, walletClient, disburserAddress, tokenAddress } = this.deps;
    const account = walletClient.account;
    if (!account) {
      throw new Error("wallet client has no account");
    }

    await publicClient.simulateContract({
      address: disburserAddress,
      abi: DISBURSER_ABI,
      functionName: "disburseFrom",
      args: [tokenAddress, planned.packed, planned.strict],
      account,
    });

    const txHash = await walletClient.writeContract({
      address: disburserAddress,
      abi: DISBURSER_ABI,
      functionName: "disburseFrom",
      args: [tokenAddress, planned.packed, planned.strict],
      account,
      chain: base,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`batch tx ${txHash} reverted`);
    }

    let attempted = 0;
    let succeeded = 0;
    const failed: { index: number; recipient: string; amount: bigint }[] = [];
    for (const log of receipt.logs) {
      try {
        if (log.address.toLowerCase() === disburserAddress.toLowerCase()) {
          const event = decodeDisburserLog(log, DISBURSER_ABI);
          if (event.name === "Disbursed") {
            attempted = Number(event.attempted);
            succeeded = Number(event.succeeded);
          } else if (event.name === "TransferFailed") {
            failed.push(event.failure);
          }
        }
      } catch {
        // skip logs that do not decode as Disburser events
      }
    }
    return { txHash, attempted, succeeded, failed };
  }
}

function decodeDisburserLog(
  log: { topics: readonly Hex[]; data: Hex },
  abi: ReturnType<typeof parseAbi>,
):
  | { name: "Disbursed"; attempted: bigint; succeeded: bigint }
  | { name: "TransferFailed"; failure: { index: number; recipient: string; amount: bigint } } {
  const transferFailedTopic = eventTopic("TransferFailed(address,uint256,address,uint256)");
  const disbursedTopic = eventTopic("Disbursed(address,address,uint256,uint256,uint256)");
  if (log.topics[0] === transferFailedTopic) {
    const index = BigInt(log.topics[2] ?? 0n);
    const recipient = `0x${(log.topics[3] ?? "0x").slice(26)}`;
    const amount = BigInt(log.data === "0x" ? "0x0" : log.data);
    return { name: "TransferFailed", failure: { index: Number(index), recipient, amount } };
  }
  if (log.topics[0] === disbursedTopic) {
    const data = log.data.slice(2);
    const attempted = BigInt(`0x${data.slice(0, 64)}`);
    const succeeded = BigInt(`0x${data.slice(64, 128)}`);
    return { name: "Disbursed", attempted, succeeded };
  }
  throw new Error("unknown log");
}

function eventTopic(signature: string): Hex {
  return keccak256(stringToHex(signature, { size: 32 }));
}

export function createBaseRelayer(
  disburserAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  rpcUrl = "https://mainnet.base.org",
): DisburserRelayer {
  const publicClient = createPublicClient({ transport: http(rpcUrl), chain: base });
  const walletClient = createWalletClient({
    transport: http(rpcUrl),
    chain: base,
  });
  return new DisburserRelayer({
    publicClient: publicClient as PublicClient,
    walletClient: walletClient as WalletClient,
    disburserAddress,
    tokenAddress,
  });
}
