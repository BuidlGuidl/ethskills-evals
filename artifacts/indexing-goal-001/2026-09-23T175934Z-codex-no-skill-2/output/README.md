# Streak

Streak is a daily onchain check-in app for a community on Base. Members write exactly one thing onchain: `checkIn(note)`, once per UTC day. Everything the product shows is derived from the contract's full `CheckedIn` event history.

## Architecture

- `contracts/StreakCheckIn.sol` is the Base contract. It enforces one check-in per address per UTC day, caps notes at 160 bytes, stores lightweight member counters, and emits the append-only `CheckedIn` event.
- `src/indexer.ts` is the read-side indexer. On boot it backfills from `STREAK_START_BLOCK` through the latest safe block, then keeps syncing with a live watcher and periodic catch-up loop.
- `src/store.ts` is the projection layer. It persists the replayed event log to a local JSON file and derives the three product views from the complete history.
- `src/server.ts` exposes the read API for the app screens.

The read side is intentionally event-sourced: if the app launches after months of check-ins, set `STREAK_START_BLOCK` to the deployment block and the indexer replays every `CheckedIn` event before serving current feed, profile, and leaderboard data.

## API

`GET /feed?limit=25&cursor=...`

Returns newest check-ins first. Items include `member`, `checkedInAt`, `note`, block metadata, and a `nextCursor` for older rows.

`GET /feed/stream?limit=25`

Server-sent events for the live feed. The first event is a `snapshot`; new check-ins arrive as `check_in`.

`GET /members/:address`

Returns a member profile:

```json
{
  "member": "0x...",
  "currentStreak": 7,
  "totalCheckIns": 42,
  "lastCheckInDay": 19889,
  "lastCheckInAt": "2024-06-15T12:34:56.000Z"
}
```

`GET /leaderboard?month=YYYY-MM&limit=50`

Returns the top members for a UTC calendar month, ranked by number of check-ins in that month. If `month` is omitted, the current UTC month is used.

`GET /health`

Returns indexer progress and whether the service is catching up.

## Deploy

1. Install dependencies:

```sh
npm install
```

2. Copy the environment template:

```sh
cp .env.example .env
```

3. Set `DEPLOYER_PRIVATE_KEY` and either `BASE_SEPOLIA_RPC_URL` or `BASE_RPC_URL`.

4. Deploy to Base Sepolia:

```sh
npm run deploy:base-sepolia
```

Or deploy to Base mainnet:

```sh
npm run deploy:base
```

The deploy script prints the contract address and deployment block. Use those as `STREAK_CONTRACT_ADDRESS` and `STREAK_START_BLOCK`.

## Run Locally

1. Set the read-side environment:

```sh
STREAK_RPC_URL=https://sepolia.base.org
STREAK_CONTRACT_ADDRESS=0x...
STREAK_START_BLOCK=123456
STREAK_CONFIRMATIONS=4
STREAK_LOG_BATCH_SIZE=5000
STREAK_DB_PATH=.data/streak-index.json
PORT=3000
```

2. Start the API:

```sh
npm run api
```

3. Query the screens:

```sh
curl http://localhost:3000/feed
curl http://localhost:3000/members/0x0000000000000000000000000000000000000000
curl "http://localhost:3000/leaderboard?month=2026-09"
```

The first API start may take time if `STREAK_START_BLOCK` is far in the past. Progress is visible at `/health`. The local projection file is generated under `.data/` and can be removed to force a full replay.

## Development

Compile the contract:

```sh
npm run compile
```

Run tests:

```sh
npm test
```

Type-check:

```sh
npm run typecheck
```

## Notes For Production

- The JSON store is simple and developer-friendly for local runs. For production, keep the same `StreakStore` interface and replace the persistence internals with Postgres, SQLite, or another durable database.
- Run the indexer from the deployment block, not from the day the frontend launches.
- Keep a small confirmation window on Base to reduce reorg risk. The live watcher is for immediacy; the periodic confirmed backfill is the source of durable progress.
