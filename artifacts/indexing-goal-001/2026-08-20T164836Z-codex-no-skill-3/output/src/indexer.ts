import { createPublicClient, http, parseAbiItem, type Address, type HttpTransport, type PublicClient } from "viem";
import { base } from "viem/chains";
import { type CheckIn } from "./domain.js";
import { StreakStore } from "./store.js";

const CHECK_IN_EVENT = parseAbiItem("event CheckIn(address indexed member, uint64 indexed day, uint64 timestamp, string note)");
const CHUNK_SIZE = 2_000n;
const REORG_OVERLAP = 128;
const CONFIRMATIONS = 5n;

export type IndexerConfig = { rpcUrl: string; contractAddress: Address; deploymentBlock: number };

export class StreakIndexer {
  readonly client: PublicClient<HttpTransport, typeof base>;
  constructor(readonly store: StreakStore, readonly config: IndexerConfig) {
    this.client = createPublicClient({ chain: base, transport: http(config.rpcUrl) });
  }

  async sync() {
    const chainHead = await this.client.getBlockNumber();
    const safeHead = chainHead > CONFIRMATIONS ? Number(chainHead - CONFIRMATIONS) : 0;
    let from = this.store.getLastSyncedBlock() ?? this.config.deploymentBlock - 1;
    if (from >= this.config.deploymentBlock) {
      from = Math.max(this.config.deploymentBlock - 1, from - REORG_OVERLAP);
      this.store.rewind(from + 1);
    }
    if (from >= safeHead) return { fromBlock: from + 1, toBlock: safeHead, indexed: 0 };

    let indexed = 0;
    for (let start = from + 1; start <= safeHead; start += Number(CHUNK_SIZE)) {
      const end = Math.min(safeHead, start + Number(CHUNK_SIZE) - 1);
      const logs = await this.client.getLogs({ address: this.config.contractAddress, event: CHECK_IN_EVENT, fromBlock: BigInt(start), toBlock: BigInt(end) });
      const checkIns: CheckIn[] = logs.map(log => ({
        member: log.args.member!, day: Number(log.args.day!), timestamp: Number(log.args.timestamp!), note: log.args.note!,
        blockNumber: Number(log.blockNumber), transactionHash: log.transactionHash, logIndex: Number(log.logIndex),
      }));
      this.store.saveCheckIns(checkIns, end);
      indexed += checkIns.length;
    }
    return { fromBlock: from + 1, toBlock: safeHead, indexed };
  }
}
