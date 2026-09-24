# Streak

Streak is a daily onchain check-in app for a Base community. Members call one write function, `checkIn(note)`, once per UTC day. Everything the product reads is reconstructed from the emitted `CheckIn` event history.

## Architecture

- `contracts/Streak.sol` is the write contract. It enforces one check-in per address per UTC day, caps the public note at 160 bytes, tracks cheap current counters onchain, and emits one event per check-in.
- `subgraph/` is the historical read model. The Graph indexes every `CheckIn` from the contract deployment block, creates immutable feed rows, updates member profile aggregates, and maintains per-member monthly counts.
- `read-api/` is a small HTTP API for the three product screens:
  - `GET /feed?limit=50&skip=0` returns newest global check-ins first.
  - `GET /members/:address` returns current streak and all-time total check-ins.
  - `GET /leaderboard?month=YYYY-MM&limit=50&skip=0` returns the top members for a UTC calendar month.

The app must not derive history by scanning blocks from the browser or by waiting for page-open events. Deploy the subgraph with the contract address and the contract deployment block as `startBlock`, then let the indexer replay the full event history.

## Contract

Install dependencies:

```bash
npm install
```

Run the contract tests:

```bash
npm run contract:test
```

Deploy to Base Sepolia:

```bash
cp .env.example .env
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
npm run contract:deploy:base-sepolia
```

Deploy to Base mainnet:

```bash
export BASE_RPC_URL=https://mainnet.base.org
npm run contract:deploy:base
```

After deployment, save the contract address and deployment block. The deployment block is the subgraph `startBlock`.

## Subgraph

Edit `subgraph/subgraph.yaml`:

```yaml
source:
  address: "0xYourStreakContract"
  startBlock: YOUR_DEPLOYMENT_BLOCK
```

Generate and build:

```bash
npm run subgraph:codegen
npm run subgraph:build
```

Deploy with The Graph CLI, for example to Subgraph Studio:

```bash
npx graph auth --studio YOUR_DEPLOY_KEY
npx graph deploy --studio streak subgraph/subgraph.yaml
```

Wait until the subgraph has synced past the latest Base block before treating the feed, profiles, or leaderboard as complete.

## Read API

Set the deployed subgraph endpoint:

```bash
export SUBGRAPH_URL=https://api.studio.thegraph.com/query/YOUR_ACCOUNT_ID/streak/version/latest
npm run read-api:dev
```

The API listens on `http://localhost:8787` by default.

Example calls:

```bash
curl "http://localhost:8787/feed?limit=20"
curl "http://localhost:8787/members/0x0000000000000000000000000000000000000000"
curl "http://localhost:8787/leaderboard?month=2026-09&limit=25"
```

## Data Model

`CheckIn` entities power the global feed. They are immutable and ordered by the monotonic `checkInId` emitted by the contract.

`Member` entities power profiles. They store the streak after the member's latest check-in, `totalCheckIns`, the last checked-in UTC day, and the latest check-in timestamp. Because missed days do not emit events, the read API returns an effective current streak of `0` when the last check-in is older than yesterday.

`MonthMember` entities power the leaderboard. Their IDs are `YYYY-MM-address`, and their `checkIns` count is incremented as the subgraph replays historical check-ins.

## Notes for Frontend Developers

Use the read API for screen data and a wallet client for the single write:

```ts
await walletClient.writeContract({
  address: streakAddress,
  abi: streakAbi,
  functionName: "checkIn",
  args: ["gm"],
});
```

After a successful transaction, poll `/feed`, `/members/:address`, or `/leaderboard` until the subgraph has indexed the transaction block.
