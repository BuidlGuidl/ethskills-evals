# Streak

Streak is a daily onchain check-in app for a Base community. Members call one contract function once per UTC day, optionally attaching a short public note. Everything the product reads comes from the emitted `CheckIn` event, indexed from the contract deployment block forward.

## What is included

- `contracts/StreakCheckIn.sol` - the write path. The only member action is `checkIn(string note)`.
- `abis/StreakCheckIn.ts` - ABI used by the indexer.
- `ponder.config.ts` - Base indexing configuration.
- `ponder.schema.ts` - materialized read tables for feed rows, member profiles, and monthly leaderboard rows.
- `src/index.ts` - Ponder event handler that backfills all historical check-ins and tails new ones.
- `src/api/index.ts` - REST endpoints for the three app screens.
- `scripts/deploy.ts` - deploys the contract with Viem.

## Architecture

The contract is intentionally small and event-first:

```solidity
event CheckIn(address indexed member, uint256 indexed day, uint64 timestamp, string note);
```

`day` is `block.timestamp / 1 days`, so check-ins are measured by UTC onchain days. The contract stores only enough state to reject duplicate same-day check-ins and expose simple direct reads. The product read side does not scan RPC at request time.

Ponder is the production indexer. It fetches every `CheckIn` log from `PONDER_START_BLOCK`, writes a persistent database, and then continues tailing Base. The HTTP API should be hosted as a long-running Ponder process with Postgres in production.

The indexed tables are:

- `check_ins`: immutable feed rows, ordered newest first.
- `members`: one row per member with all-time totals and the streak through their latest check-in.
- `monthly_member_check_ins`: one row per member per UTC month for leaderboard queries.

The profile endpoint calculates the effective current streak at read time. A streak remains current if the member checked in today or yesterday UTC; it returns `0` after a full UTC day is missed.

## API

Ponder serves these custom endpoints:

- `GET /api/feed?limit=50`
  - Global newest-first feed.
- `GET /api/members/:address`
  - Member profile with `currentStreak` and `totalCheckIns`.
- `GET /api/leaderboard/monthly?month=YYYY-MM&limit=50`
  - Top members in a UTC month. Omit `month` for the current UTC month.

Ponder also exposes its generated GraphQL and SQL-over-HTTP APIs if a frontend team wants typed queries over the same tables.

## Local setup

Install dependencies:

```bash
npm install
```

Create an environment file:

```bash
cp .env.example .env
```

Set:

- `STREAK_CONTRACT_ADDRESS` to the deployed Base contract.
- `PONDER_START_BLOCK` to the deployment block from the deploy script.
- `PONDER_RPC_URL_8453` to a Base RPC endpoint. A production deployment should use a reliable paid RPC endpoint.

Run the indexer and API locally:

```bash
npm run dev
```

Ponder will backfill from `PONDER_START_BLOCK`, then serve HTTP on its local port. The API is ready for user traffic only after `/ready` returns `200`.

## Deploy the contract

Compile locally:

```bash
npm run compile
```

Deploy to Base:

```bash
BASE_RPC_URL=https://mainnet.base.org \
PRIVATE_KEY=0x... \
npm run deploy
```

The deploy script prints the contract address and deployment block. Put those into `STREAK_CONTRACT_ADDRESS` and `PONDER_START_BLOCK` before starting Ponder.

For Base Sepolia, set `CHAIN=base-sepolia` and use a Base Sepolia RPC URL.

## Production indexing

Run Ponder against Postgres as the read-side service:

```bash
DATABASE_URL=postgres://user:password@host:5432/streak \
STREAK_CONTRACT_ADDRESS=0x... \
PONDER_START_BLOCK=12345678 \
PONDER_RPC_URL_8453=https://base-mainnet.example \
npm run start
```

Host this as one continuously running worker/API process on a platform that supports Node.js and Postgres. Scale reads separately with `npm run serve` if needed after the indexing process is healthy. Monitor `/health`, `/ready`, `/status`, and `/metrics`.

## Verification

```bash
npm run test
npm run typecheck
```
