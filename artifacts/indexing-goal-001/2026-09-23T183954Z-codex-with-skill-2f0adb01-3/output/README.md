# Streak

Streak is a daily onchain check-in app for a Base community. Members write exactly one thing onchain: `checkIn(string note)`. Everything the app reads is rebuilt from the `CheckedIn` event history, so a deployment with months of existing activity can be indexed from the contract deployment block and immediately power the feed, profile, and monthly leaderboard.

## Architecture

- `contracts/Streak.sol` is the write side. It allows one check-in per address per UTC day, caps the public note at 160 bytes, and emits `CheckedIn(member, day, checkInId, note)`.
- `src/index.ts` is the Ponder indexer. It backfills every historical `CheckedIn` log from `STREAK_START_BLOCK`, stores immutable feed rows, and maintains member and member-month aggregates.
- `src/api/index.ts` exposes the read side for the three screens:
  - `GET /feed?limit=25` returns newest check-ins first.
  - `GET /members/:address` returns all-time total check-ins and the effective current streak.
  - `GET /leaderboard/monthly?month=YYYY-MM&limit=50` returns the top members for a UTC month.
- Ponder also exposes GraphQL at `/graphql` for ad hoc reads over the same indexed tables.

The contract deliberately treats events as the durable read API. Do not build the launch backfill by looping through blocks in an app server; configure the indexer with the deployment block and let Ponder backfill logs and stay live.

## Local Setup

Install dependencies:

```bash
npm install
```

Run the contract and helper tests:

```bash
npm test
```

Create a local env file:

```bash
cp .env.example .env
```

For local indexing against Anvil, start a Base-shaped local chain:

```bash
anvil --chain-id 8453
```

Deploy locally:

```bash
export PRIVATE_KEY=0x...
forge script script/DeployStreak.s.sol:DeployStreak \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

Set `STREAK_CONTRACT_ADDRESS` to the deployed address and `STREAK_START_BLOCK` to the deployment block, then start the read side:

```bash
npm run dev
```

Ponder serves the API on `http://localhost:42069` by default:

```bash
curl http://localhost:42069/feed
curl http://localhost:42069/members/0x0000000000000000000000000000000000000000
curl "http://localhost:42069/leaderboard/monthly?month=2026-09"
```

## Deploying To Base

1. Deploy `Streak`:

```bash
export BASE_RPC_URL=https://your-base-rpc.example
export PRIVATE_KEY=0x...
forge script script/DeployStreak.s.sol:DeployStreak \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

2. Record the deployed contract address and deployment block.
3. Configure the indexer:

```bash
BASE_RPC_URL=https://your-base-rpc.example
STREAK_CONTRACT_ADDRESS=0xYourContract
STREAK_START_BLOCK=12345678
PONDER_CHAIN_ID=8453
```

4. Run Ponder in production with a persistent Postgres database:

```bash
DATABASE_URL=postgres://user:pass@host:5432/streak npm run start
```

Ponder will backfill from `STREAK_START_BLOCK`, create the read tables, and continue indexing new Base blocks. The HTTP API and GraphQL endpoint read from the indexed database, so the three screens include the contract's complete history rather than only events observed after a browser tab opens.

## Streak Semantics

`day` is `block.timestamp / 1 days`, so day boundaries are UTC. The API reports a streak as active if the member checked in today or yesterday. If the last check-in is older than yesterday, `currentStreak` is returned as `0`; this is computed at request time because missed days do not emit events.
