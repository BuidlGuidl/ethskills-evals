# Streak

Streak is a Base community check-in protocol. Members call `checkIn(note)` once per UTC day; the `CheckedIn` event is the complete, public activity history. The included read service starts by backfilling every event from the configured deployment block, then continually follows new finalized blocks.

## Architecture

`contracts/src/Streak.sol` is the only write surface. It enforces one check-in per account per UTC day and emits `CheckedIn(account, day, note)`. On-chain mappings provide a cheap current-day guard and total, but the feed and historical calculations deliberately come from events.

`indexer/` is a durable SQLite read model. It stores each log with its transaction/log identity, block timestamp, and UTC day. Its cursor is only advanced in the same SQLite transaction as the chunk inserts, so a restart safely replays a chunk. `INSERT OR IGNORE` makes replay idempotent. Startup synchronizes from `DEPLOYMENT_BLOCK`, not from the process start block, which makes months of pre-launch history visible.

The API is intentionally thin:

- `GET /v1/feed?limit=30&before=<id>` — newest-first global feed, cursor paginated.
- `GET /v1/members/:address` — `{ currentStreak, totalCheckIns }` calculated from the member's complete ordered days. A check-in today or yesterday keeps a streak active.
- `GET /v1/leaderboard?limit=50` — UTC-calendar-month totals, descending.

For a production multi-instance deployment, replace SQLite with Postgres and protect the single indexer with a lease (or run one indexer and many API replicas). The supplied service waits ten confirmations by default; it is append-only for finalized blocks. If Base reorg handling beyond that window is required, periodically rewind the cursor and delete/replay the corresponding block range.

## Deploy the contract

Requirements: Foundry and a funded Base deployer key.

```sh
forge test
forge create contracts/src/Streak.sol:Streak \
  --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

Record the deployed contract address and the transaction's deployment block. That exact block is required by the indexer; choosing a later block permanently omits old check-ins from the read model.

## Run the read API locally

```sh
cd indexer
npm install
cp .env.example .env
# Edit RPC_URL, CONTRACT_ADDRESS, and DEPLOYMENT_BLOCK.
npm run check
npm run dev
```

Then, for example, open `http://localhost:3000/v1/feed`. The first launch may take time because it intentionally reads the entire contract history in bounded 2,000-block log queries. The SQLite database is a runtime artifact and is not source code.

## Frontend integration

Use any Base wallet client to submit `checkIn("gm")`, then render the three API resources above. Notes are public, event data and are capped at 280 UTF-8 bytes. Treat API output as finalized with the configured confirmation delay; a frontend can optimistically show its own pending transaction separately.
