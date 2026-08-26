# Streak

Streak is a Base community check-in app. A wallet can call `checkIn(note)` once per UTC day. The contract stores only the guard needed to enforce that rule; its `CheckIn` event is the complete public record used by the app.

## Architecture

```
wallet ── checkIn(note) ──> Streak.sol on Base ── CheckIn events ──> TypeScript indexer ──> SQLite projection ──> REST screens
```

The indexer always begins at `STREAK_DEPLOYMENT_BLOCK`, not at service startup. It scans all historical `CheckIn` logs in bounded block ranges and saves an idempotent projection keyed by transaction hash and log index. On later syncs it deletes and replays the trailing 128 blocks, while only indexing blocks with five confirmations. This keeps the projection correct through normal shallow Base reorgs. The SQLite database is a disposable cache: delete it to perform a full replay.

All calendar logic uses UTC days (`floor(timestamp / 86400)`). This matches the contract rule, avoids server-timezone bugs, and makes “this month” mean the current UTC calendar month.

The read service supplies the three product screens:

- `GET /feed?limit=50` returns newest check-ins first, with member, timestamp, note, and transaction hash.
- `GET /members/:address` returns `currentStreak` and `totalCheckIns`. A streak ends today or yesterday and walks backward through consecutive UTC days.
- `GET /leaderboard/month?limit=100` returns members ordered by their check-in count in the current UTC month.

Every response includes `lastSyncedBlock` so a UI can display sync status. The server syncs once at boot, before every read (coalescing concurrent syncs), and every 15 seconds.

## Deploy the contract

Install Foundry, then deploy to Base. `checkIn` is deliberately the only state-changing application function.

```bash
export BASE_RPC_URL='https://your-base-rpc.example'
export PRIVATE_KEY='0x...'
forge script script/Deploy.s.sol:DeployStreak \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

Record both the deployed contract address and the transaction's **Base block number**. The deployment block is part of the indexer's correctness boundary; setting it to a later block drops old check-ins.

For a Base Sepolia deployment, add `--chain base-sepolia` and use a Sepolia RPC. The contract has no owner, upgrade path, or off-chain authorization.

## Run the read service locally

Requires Node.js 20+ and a Base RPC provider that supports `eth_getLogs` for the full requested history.

```bash
npm install
cp .env.example .env
# Edit .env with your RPC URL, deployed address, and exact deployment block.
npm run dev
```

The first startup backfills all events from the deployment block, which can take time for a long-lived contract. Subsequent starts use `DATABASE_PATH` and only replay a small overlap. To force a full rebuild:

```bash
rm -f data/streak.sqlite data/streak.sqlite-shm data/streak.sqlite-wal
npm run index
```

Example calls after the server starts:

```bash
curl 'http://localhost:3000/feed?limit=20'
curl 'http://localhost:3000/members/0x0000000000000000000000000000000000000000'
curl 'http://localhost:3000/leaderboard/month?limit=50'
```

Run the pure calendar/streak tests with `npm test`. The only generated directories configured for Foundry are `out/`, `cache/`, and `lib/`; all source is kept in `contracts/`, `script/`, and `src/`.
