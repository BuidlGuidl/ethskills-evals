# Streak

Streak is a daily onchain check-in app for a community on Base. Members write exactly one thing onchain: `checkIn(note)`, once per UTC day. Everything needed for the three read screens comes from the emitted event history.

## Architecture

- `contracts/StreakCheckIn.sol` is the write surface. It enforces one check-in per address per UTC day, caps notes at 160 bytes, and emits `CheckedIn(member, day, timestamp, note)`.
- `src/indexer.ts` is the read-side worker. It backfills `CheckedIn` logs from `START_BLOCK`, stores them in SQLite, records a durable cursor, and then keeps polling near the chain head.
- `src/store.ts` maintains the query models for the product screens: recent feed rows, per-member totals and streaks, and monthly leaderboard counts.
- `src/api.ts` exposes the read API consumed by the app screens.

The important bit: screens never scan Base. The indexer processes the complete event history from the contract deployment block before the API answers historical feed, profile, or leaderboard questions.

## API

```text
GET /feed?limit=25&cursor=blockNumber:logIndex
GET /members/:address
GET /leaderboard?month=2026-09&limit=25
GET /sync/status
GET /health
```

Feed items are newest first and include `member`, `timestamp`, `note`, transaction metadata, and a `cursor` for pagination. Member profiles include `currentStreak` and `totalCheckIns`. Leaderboard entries are ranked by check-ins in the requested UTC month.

## Local Setup

Use Node.js 24 or newer. The local read model uses Node's built-in SQLite module, so no native SQLite package is required.

```bash
npm install
cp .env.example .env
```

Set these values in `.env`:

- `RPC_URL`: Base or Base Sepolia RPC URL.
- `CHAIN_ID`: `8453` for Base, `84532` for Base Sepolia.
- `CONTRACT_ADDRESS`: deployed `StreakCheckIn` address.
- `START_BLOCK`: deployment block. This is how the indexer knows where complete history begins.
- `DATABASE_PATH`: local SQLite file, for example `./data/streak.sqlite`.

Run the indexer and API together:

```bash
npm run dev
```

Or run them as separate processes:

```bash
npm run indexer
npm run api
```

## Deploying The Contract

Compile the contract:

```bash
npm run compile:contracts
```

Deploy to Base Sepolia or Base with a funded key:

```bash
PRIVATE_KEY=0x... npm run deploy
```

The deploy script prints the contract address and deployment block. Put those into `.env` as `CONTRACT_ADDRESS` and `START_BLOCK` before starting the indexer.

## Why This Read Side Works For Launch

The contract treats events as the public data API. Since every check-in emits a `CheckedIn` event, the indexer can replay from the deployment block and reconstruct months of history before the frontend opens. The feed is served from indexed rows, the profile is served from member aggregates, and the leaderboard is served from monthly aggregates.

For a larger hosted production setup, the same event model can be moved to a managed indexer or a subgraph. The API contract stays the same: historical reads come from indexed event data, not from browser-side block scans.

## Verification

```bash
npm run build
npm test
```
