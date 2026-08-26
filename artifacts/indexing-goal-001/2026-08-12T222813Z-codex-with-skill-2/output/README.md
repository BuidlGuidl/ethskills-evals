# Streak

Streak is a once-per-UTC-day check-in contract on Base with a historical read model for a global feed, member profiles, and a monthly leaderboard.

## Architecture

`contracts/src/Streak.sol` is the only write path. `checkIn(note)` rejects a second check-in in the same UTC day and notes over 280 UTF-8 bytes, then emits `CheckedIn(member, day, note)`. Events are the durable read API.

`subgraph/` is a Graph Protocol subgraph. Starting at the contract deployment block, it replays every `CheckedIn` event and stays synced. It stores immutable feed rows plus `Member` and `MemberMonth` aggregates. This makes launch-day results include the contract's complete history; the app never scans blocks or depends on a browser having been open. A member's indexed streak is normalized by `src/read/streakClient.ts` to zero after a missed UTC day.

The three screen reads are exposed by `StreakClient`: `getFeed`, `getMember`, and `getMonthlyLeaderboard`. Writes can use any wallet library to call `checkIn(string)` directly on Base.

## Install and test

Requirements: Node 20+, npm, and Foundry.

```sh
npm install
cd contracts && forge install foundry-rs/forge-std --no-commit && cd ..
npm run test:contract
npm --prefix subgraph install
```

## Deploy the contract

Test on Base Sepolia first:

```sh
export BASE_SEPOLIA_RPC_URL=https://your-base-sepolia-rpc
export PRIVATE_KEY=0x...
forge script contracts/script/Deploy.s.sol:Deploy --root contracts \
  --rpc-url base_sepolia --private-key "$PRIVATE_KEY" --broadcast --verify
```

For production, set `BASE_RPC_URL` and replace `base_sepolia` with `base`. Record the deployed address and deployment block from the receipt.

## Configure and deploy the index

In `subgraph/subgraph.yaml`, replace the zero `source.address` with the deployed contract and set `startBlock` to its exact deployment block. This is load-bearing: starting later silently omits history; starting at zero works but wastes indexing work.

Create a subgraph named `streak-base` in Subgraph Studio, authenticate the Graph CLI, then:

```sh
npm run subgraph:codegen
npm run subgraph:build
npx --prefix subgraph graph auth --studio YOUR_DEPLOY_KEY
npm --prefix subgraph run deploy
```

Wait until Studio reports the subgraph synced through the current Base block before directing production traffic to it. Publish it to The Graph Network for production availability.

## Run the read side locally

The read side is a framework-neutral TypeScript module; import it into the web/server app backing the three screens:

```ts
import { StreakClient } from "./src/read/streakClient";

const streak = new StreakClient(process.env.SUBGRAPH_URL!);
const feed = await streak.getFeed(50);
const profile = await streak.getMember("0x...");
const leaders = await streak.getMonthlyLeaderboard();
```

Set `SUBGRAPH_URL` to the Studio development query URL locally and to the published gateway URL in production. Use pagination for deeper feed history. Dates, streak boundaries, and month buckets are UTC. The contract address, deployment block, subgraph endpoint, and chain ID (`8453`, or `84532` on Sepolia) should be environment configuration in the consuming app.
