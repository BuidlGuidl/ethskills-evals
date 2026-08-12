# Streak

Streak is one Base transaction per member per UTC day, plus a historical read API for a live feed, member profiles, and the current-month leaderboard.

## Architecture

`src/Streak.sol` enforces one check-in per address per UTC day and caps the optional public note at 280 UTF-8 bytes. `CheckedIn(member, utcDay, note)` is the canonical event API; the contract intentionally does not store feeds, totals, or rankings onchain.

The subgraph in `subgraph/` starts at the contract deployment block, backfills every `CheckedIn` event, and then follows Base. It materializes:

- immutable `CheckIn` rows for the newest-first global feed;
- `Member` totals, last activity, and streak-at-last-check-in;
- `MonthlyMember` counters for leaderboard queries.

The service in `api/` exposes those models as JSON. It converts a stored streak to zero when the member has checked in neither today nor yesterday. The Graph provides historical backfill; this service never scans blocks or relies on a browser having been open. “Live” means the UI polls `/feed` and sees events after Base confirmation plus subgraph indexing lag.

All day/month boundaries are UTC. Addresses are the member identity; ENS or community names can be resolved by a UI.

## Prerequisites

- Node.js 20+
- Foundry
- A funded Base deployer key and Base RPC URL
- A Subgraph Studio account and deploy key

## Install and test

```bash
npm install
forge install foundry-rs/forge-std --no-commit
forge test
npm run codegen
npm run build:subgraph
npm run typecheck
```

`lib/`, generated subgraph types, Solidity artifacts, and caches are intentionally ignored.

## Deploy the contract

Test on Base Sepolia by substituting its RPC URL, then deploy to Base:

```bash
export BASE_RPC_URL=https://your-base-rpc.example
export DEPLOYER_PRIVATE_KEY=0x...
forge create src/Streak.sol:Streak \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

Record the deployed address and the deployment transaction's block number. The key should come from a secure secret manager in CI; do not commit it.

## Deploy the historical indexer

Before deploying, edit `subgraph/subgraph.yaml`:

1. Replace the zero `source.address` with the deployed contract address.
2. Replace `startBlock: 0` with the exact deployment block. Starting there guarantees complete history while avoiding a chain-wide scan.
3. For testing on Base Sepolia, change `network: base` to `base-sepolia`.

Then authenticate and deploy:

```bash
npx graph auth --studio YOUR_DEPLOY_KEY
export SUBGRAPH_SLUG=streak
npm run codegen
npm run build:subgraph
npm run deploy:subgraph
```

Wait until Studio reports the subgraph synced to the chain head. Deploying the subgraph later is safe: it backfills from `startBlock`, so pre-launch months are included.

## Run the read API locally

```bash
cp .env.example .env
# Set SUBGRAPH_URL in .env to the Studio query URL.
npm run dev:api
```

Endpoints:

- `GET /feed?limit=50&skip=0` — newest check-ins first; poll for updates.
- `GET /members/0x...` — current streak and all-time total.
- `GET /leaderboard?month=2026-08&limit=100` — top members for a UTC month; month defaults to the current UTC month.

The feed's offset pagination is intended for recent-screen browsing. Consumers exporting very large histories should query the subgraph directly in bounded pages. The service returns `Cache-Control: no-store`; production deployments should add rate limiting and observability at the edge.
