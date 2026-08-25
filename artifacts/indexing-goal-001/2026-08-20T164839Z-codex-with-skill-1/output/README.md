# Streak

Streak is a Base check-in contract plus an indexer-backed HTTP read API. A member calls `checkIn(note)` once per UTC day. The contract emits the complete public record in `CheckedIn(member, day, checkedInAt, note)`; the API derives the feed, profile streaks, totals, and monthly leaderboard from those events.

## Architecture

`contracts/Streak.sol` is the only write surface. It limits notes to 280 bytes and prevents a second check-in by the same address on the same `block.timestamp / 1 days` UTC day.

`src/sync.ts` is a persistent Base event indexer. On its first run it starts exactly at `STREAK_START_BLOCK` (the deployment block), chunks through all historical `CheckedIn` logs, and stores them in PostgreSQL. It checkpoints `next_block`, waits for configurable confirmations, then tails new blocks. The UI should call `src/server.ts`, never scan RPC logs: feeds and rankings therefore include check-ins from before the app opened.

Production home: run the Node service as a continuously supervised container/service (for example Render, Fly.io, or ECS) attached to managed PostgreSQL (for example Neon, RDS, or Render Postgres). Set a durable `DATABASE_URL`, a Base RPC provider URL, contract address, and deployment block. Keep one replica unless you add a job lock. Back up PostgreSQL. The indexer is intentionally independent of a browser and stays current even when nobody has the site open.

## API

- `GET /feed?limit=25` — newest check-ins first.
- `GET /members/:address` — `{ currentStreak, totalCheckins }`; a streak is an uninterrupted UTC-day run ending today or yesterday, otherwise zero.
- `GET /leaderboard/month?month=2026-08&limit=25` — UTC-month check-in counts, descending.
- `GET /health` — indexer checkpoint.

All values are derived from the full event table. The database uniqueness constraint on `(member, day)` is a defensive mirror of the contract rule.

## Deploy the contract

Use Foundry (or your normal Solidity deployment tool) with Solidity `0.8.24`. With `BASE_RPC_URL` and `PRIVATE_KEY` set, deploy using `forge script script/DeployStreak.s.sol:DeployStreak --rpc-url "$BASE_RPC_URL" --broadcast`. Record the block number of the deployment transaction. That block number is not optional: using it for `STREAK_START_BLOCK` ensures the initial index catches every event ever emitted by this deployment. Verify the contract source on BaseScan after deploying.

## Run locally

1. Install Node 20+ and Docker, then run `docker compose up -d`.
2. Copy `.env.example` to `.env`, set a Base RPC URL, deployed contract address, and its exact deployment block. For a local Anvil deployment, use its RPC URL and chain configuration in `src/sync.ts` instead.
3. Run `npm install`, then `npm run migrate`.
4. Start the service with `npm run dev`. Its first startup performs the historical backfill; subsequent polls tail confirmed Base blocks every 15 seconds.

For a one-shot catch-up run `npm run sync`. Run migrations once before the service. Monitor `/health`, database storage, RPC errors, and the lag between `nextBlock` and the Base head.
