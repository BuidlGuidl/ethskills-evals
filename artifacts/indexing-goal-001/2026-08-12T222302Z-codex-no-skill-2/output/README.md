# Streak

Daily onchain check-ins on Base, plus a complete-history read service for the global feed, member profiles, and monthly leaderboard.

## Architecture

`contracts/Streak.sol` is the only write path. `checkIn(note)` permits one transaction per address per UTC day, caps notes at 280 UTF-8 bytes, stores only the member's last check-in day, and emits the durable `CheckedIn(member, day, timestamp, note)` record. Events keep the contract cheap; clients should not attempt to derive historical views from contract storage.

`src/indexer.ts` is the historical read path. On its first start it calls `eth_getLogs` in bounded ranges beginning at `DEPLOYMENT_BLOCK`, not at the current head. It writes decoded logs and an indexing cursor to SQLite in the same transaction, then polls for new confirmed blocks. Inserts are idempotent by `(transaction hash, log index)`. It checks the last indexed block hash and rewinds on a detected reorganization. The API starts only after this initial backfill finishes, so it never presents a partial "live-only" history as complete.

`src/read-model.ts` derives all three views from that event history:

- `GET /api/feed?limit=50&cursor=...` — globally newest first, with stable cursor pagination.
- `GET /api/members/:address` — current consecutive-day streak and all-time count. A streak remains current through the day after the last check-in, allowing the member the full current UTC day to continue it.
- `GET /api/leaderboard?year=2026&month=8&limit=100` — counts within a UTC calendar month, ordered by count then address.

SQLite is suitable for one service instance. For horizontal scale, keep the same event/cursor model but move the tables to Postgres and run one elected indexer. Base logs can be numerous; use an archival-capable RPC provider that serves the deployment block onward.

## Contract: test and deploy

Prerequisites: Foundry, Node 24+, npm, a funded Base deployer, and a Base RPC endpoint.

```sh
forge test
forge build
```

Deploy to Base Sepolia first. Keep secrets in environment variables or your wallet tooling, not source control:

```sh
export BASE_SEPOLIA_RPC_URL='https://...'
export DEPLOYER_PRIVATE_KEY='...'
forge create contracts/Streak.sol:Streak \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

For production, use a hardware wallet or deployment system and Base mainnet (chain ID 8453). Record both the printed contract address and the deployment transaction's block number; the exact block is required for a complete, efficient backfill. Verify the same source with `forge verify-contract` and the relevant BaseScan API configuration.

## Read service: local setup

```sh
npm install
cp .env.example .env
```

Set `RPC_URL`, `CONTRACT_ADDRESS`, and `DEPLOYMENT_BLOCK` in your environment (Node does not implicitly load `.env`; use your process manager, or `set -a; . ./.env; set +a` in a development shell). Then:

```sh
npm run typecheck
npm test
npm start
```

The service creates `data/streak.sqlite`, backfills all confirmed history, and then listens on port 3000. Initial startup can take time and intentionally does not serve incomplete results. `CONFIRMATIONS` defaults to 10, `LOG_CHUNK_SIZE` to 5,000 blocks, and `POLL_INTERVAL_MS` to 2,000; reduce the chunk size if the RPC limits log ranges.

Example write from a connected account:

```sh
cast send "$CONTRACT_ADDRESS" 'checkIn(string)' 'gm' \
  --rpc-url "$RPC_URL" --private-key "$MEMBER_PRIVATE_KEY"
```

Example reads:

```sh
curl 'http://localhost:3000/api/feed?limit=20'
curl 'http://localhost:3000/api/members/0x0000000000000000000000000000000000000001'
curl 'http://localhost:3000/api/leaderboard?year=2026&month=8'
```

## Operations

Persist and back up `DB_PATH`. Health checks can call `GET /health`. Logs older than the RPC retention window require an archive provider. If the database is lost, restarting from an empty DB deterministically rebuilds every view from `DEPLOYMENT_BLOCK`. To force a rebuild, stop the service, move the SQLite file aside, and restart; do not change the deployment block to a newer value.

The API is intentionally read-only and can sit behind a CDN or reverse proxy. Add rate limiting there. Monitor `indexing failed` logs and RPC lag. The confirmation delay trades freshness for reorg safety; deeper detected reorgs are automatically rewound in 100-block steps.
