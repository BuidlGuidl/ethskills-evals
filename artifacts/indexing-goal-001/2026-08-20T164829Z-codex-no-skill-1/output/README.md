# Streak

Streak is a daily Base check-in: `checkIn(note)` is the sole write. The contract emits one immutable `CheckedIn` event per member per UTC day; the read service indexes those events from the deployment block onward and serves the feed, profiles, and monthly leaderboard.

## Architecture

`contracts/Streak.sol` enforces one check-in per UTC day, stores only the latest day and lifetime count for inexpensive on-chain validation, and emits the complete public record. `src/indexer.ts` is an event-sourced indexer. Its durable cursor begins at `STREAK_DEPLOYMENT_BLOCK`, so a new database backfills the entire contract history instead of only seeing newly-opened pages or newly-arriving events. Event identity is `(transaction_hash, log_index)`, making re-runs safe. PostgreSQL holds the read model and `src/api.ts` exposes it.

The indexer chunks RPC log requests and commits its cursor only after each chunk is stored. In production, use a Base RPC provider with archive log access. For chain reorg tolerance, run a periodic small rewind/reconciliation (or consume finalized blocks); Base’s short reorg window makes this straightforward.

## Contract deployment

Compile and deploy `contracts/Streak.sol` using Foundry, Hardhat, or your normal Solidity deployment pipeline to Base. Record the deployed address and the deployment transaction’s block number. No owner, upgrade, or privileged role is required.

The front end writes by calling:

```ts
walletClient.writeContract({ address, abi, functionName: "checkIn", args: [note] });
```

Use the same ABI event as `src/contract.ts` for client decoding if needed. Notes are public and limited to 280 bytes; clients should display them as untrusted text.

## Run locally

1. Start PostgreSQL and create a `streak` database (or run `docker compose up -d postgres`).
2. `cp .env.example .env`, then set the Base RPC URL, contract address, and **actual deployment block**.
3. `npm install`
4. In one terminal, backfill and follow the chain: `npm run dev:indexer`
5. In another terminal, serve reads: `npm run dev:api`

Use `npm run index` for a one-off complete sync and `npm run build` for type checking.

## Read API

- `GET /feed?beforeBlock=<blockNumber>&beforeLogIndex=<logIndex>` returns the newest 50 check-ins, newest first. Send the final item’s `blockNumber` and `logIndex` as the next cursor; the tuple cursor prevents events in a busy block from being skipped.
- `GET /members/:address` returns `{ totalCheckIns, currentStreak }`. A streak is consecutive UTC contract days ending today or yesterday; yesterday keeps it alive until today’s check-in window expires.
- `GET /leaderboard/month` returns the current UTC-month members ranked by check-ins.

All three screens read the same complete event history. The API intentionally does not make chain RPC calls per request, so historical data remains available and fast after indexing.
