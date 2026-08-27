# Streak

Streak is a once-per-UTC-day check-in contract on Base plus a durable event indexer and JSON read API. The contract has one write, `checkIn(string note)`. The read side backfills `CheckedIn` events from the deployment block, so opening the app does not define its history.

## Architecture

- `contracts/Streak.sol`: enforces one check-in per address per UTC day and a 140-byte note limit. It emits the member, UTC day number, and note.
- `src/indexer.ts`: reads Base logs **from `START_BLOCK` through the confirmed head**, oldest first. It persists every check-in and updates member streak/total and monthly aggregates in one SQLite transaction.
- `src/server.ts`: serves the three UI read models. Run it separately from the indexer so API traffic cannot stall ingestion.
- SQLite is the local/default store. A checkpoint block hash detects a reorganization; on mismatch the small, correctness-first implementation clears derived state and deterministically replays from `START_BLOCK`. `CONFIRMATIONS` avoids most reorgs.

Day and month boundaries are UTC. A streak stays active if the member checked in today or yesterday, and becomes zero after a missed day; checking in after a gap starts again at one. Addresses are normalized lowercase in the database. Feed order is chain order: block then log index, newest first.

## Deploy

Requires Node 20+ and an RPC endpoint. Install dependencies and deploy to Base Sepolia by default:

```sh
npm install
cp .env.example .env
# set BASE_RPC_URL and DEPLOYER_PRIVATE_KEY
npm run deploy
```

Set `CHAIN=base` to deploy to Base mainnet. The command prints `address` and `startBlock`; put those exact values in `CONTRACT_ADDRESS` and `START_BLOCK`. Do not guess the start block or use the current block: that would omit launch-day history. The deployer key is only used by the deploy script and is not needed at runtime.

## Run locally

Set the deployed address/start block in `.env`, then use two terminals:

```sh
npm run index
npm run dev
```

The initial index run backfills all history before tailing the confirmed chain. For production, put `data/` on a persistent volume, use a reliable Base archive-capable RPC provider, and supervise the two processes. The public Base RPC is suitable for a quick start but may rate-limit a months-long backfill. Tune `CHUNK_SIZE`; some providers cap log ranges. Run `npm test` and `npm run typecheck` before deployment.

## Read API

- `GET /feed?limit=50&beforeBlock=...&beforeLog=...` — newest check-ins, with address, timestamp, note, and transaction reference. Use the last item as the next cursor.
- `GET /members/0x...` — current streak, all-time total, and latest check-in day/time.
- `GET /leaderboard?month=2026-08&limit=50` — top members for a UTC calendar month; defaults to the current month. Equal counts sort by address for stable output.
- `GET /health` — process health and last indexed block. Compare that block with the chain's confirmed head for readiness; `ok` alone does not mean the initial backfill is complete.

The API is intentionally presentation-neutral; a web/mobile client can consume these three endpoints directly. SQLite is appropriate for a single indexer instance. For horizontal scale, retain the same tables/transactions but move them to Postgres and ensure only one ingestion writer owns a chain range.
