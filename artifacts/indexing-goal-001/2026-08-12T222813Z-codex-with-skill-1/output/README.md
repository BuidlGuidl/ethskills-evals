# Streak

Daily onchain check-ins for a Base community. The only write is `Streak.checkIn(note)`; the three product reads come from a subgraph that backfills every `CheckedIn` event from the deployment block.

## Architecture

`contracts/Streak.sol` enforces one check-in per address per UTC day and a 280-byte note limit. It emits the member, UTC day, exact timestamp, and note. It deliberately does not store feeds, totals, streaks, or leaderboards onchain.

`subgraph/` is the historical read model. On deployment it starts at the contract creation block, replays all events, then follows Base continuously:

- `CheckIn`: immutable feed row, queried newest-first.
- `Member`: all-time total, latest day, and consecutive-day streak.
- `MonthlyMember`: `(UTC month, member)` aggregate for the leaderboard.

`src/streakClient.ts` is the UI-facing read SDK: `feed`, `watchFeed`, `member`, and `leaderboard` directly back the three screens. `watchFeed` polls the indexed head. A member's stored consecutive run is converted to a current streak of zero when their last check-in is older than yesterday. Pagination uses `skip` for a simple initial implementation; use cursor pagination before feeds exceed Graph Node's skip limit.

The index is the source for complete history. Do not reconstruct these views by scanning Base RPC logs in the browser: provider block ranges and rate limits make months-long scans unreliable. The contract event is the durable source of truth; the subgraph is rebuildable.

## Local development

Requirements: Node 20+, npm, Foundry, and Docker (only if running a local Graph Node).

```sh
npm install
npm test
```

`npm test` type-checks the read client and compiles both the Solidity contract and subgraph. `forge build` is also supported; Foundry may download the pinned compiler on first use.

For a local chain:

```sh
anvil
forge create contracts/Streak.sol:Streak --rpc-url http://127.0.0.1:8545 --private-key <anvil-key>
```

Replace the zero address, `startBlock: 0`, and `network: base` in `subgraph/subgraph.yaml` with the deployed address, its receipt block, and the local Graph Node network name. Then run `npm run codegen` and `npm run build:subgraph`. Start a standard Graph Node stack connected to Anvil, create the subgraph, and deploy it:

```sh
npx graph create --node http://localhost:8020 streak
npx graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 streak subgraph/subgraph.yaml
```

Construct the read client with the resulting GraphQL endpoint:

```ts
import { StreakClient } from "./src/streakClient.js";

const streak = new StreakClient(process.env.STREAK_SUBGRAPH_URL!);
const feed = await streak.feed();
const profile = await streak.member("0x...");
const leaders = await streak.leaderboard();
```

## Base deployment

1. Set `BASE_RPC_URL` and a funded deployer key, then deploy and record both the address and exact creation block:

   ```sh
   forge create contracts/Streak.sol:Streak --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --verify
   ```

2. Put the address and creation block into `subgraph/subgraph.yaml`. `startBlock` must be the creation block—not today's block—so every pre-launch check-in is replayed. Keep `network: base` (`base-sepolia` for testnet).
3. Create a subgraph in Subgraph Studio, authenticate, then run `npm run codegen`, `npm run build:subgraph`, and `npx graph deploy --studio <slug> subgraph/subgraph.yaml`.
4. Wait until `_meta.block.number` reaches the Base head and `hasIndexingErrors` is false before launch. Configure the frontend's `STREAK_SUBGRAPH_URL` to the published endpoint.

The Graph handles chain reorganizations by reverting mappings and replaying the canonical chain. For production, monitor indexing health/lag and show the indexed block in operational diagnostics. Contract upgrades should use a new data source beginning at the upgrade block while retaining the original source, so history stays continuous.
