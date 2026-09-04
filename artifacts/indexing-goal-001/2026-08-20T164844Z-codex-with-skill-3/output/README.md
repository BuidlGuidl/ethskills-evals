# Streak on Base

Streak has one onchain write: `checkIn(string note)`. The contract prevents an address
from checking in twice in the same UTC day and emits a `CheckedIn` event containing
everything needed by the product read side.

The screens are served by the HTTP API in `src/api.ts`:

- `GET /feed?limit=30&before=<ISO timestamp>` — newest global check-ins.
- `GET /members/:address` — current consecutive-day streak and all-time count.
- `GET /leaderboard/month?limit=100` — current UTC-month ranking.

## Architecture

```
Base Streak.checkIn ──CheckedIn event──> indexer worker ──> Postgres <── API ──> app screens
                                      backfill + tail
```

`src/indexer.ts` starts at the configured deployment block, advances through every
confirmed Base block in bounded log queries, persists every event, and retains a
cursor in Postgres. On later starts it resumes from that cursor and tails the chain.
It does **not** call `getLogs` during API requests. This is what makes launch-time
feed, profile, and monthly leaderboard results include months of pre-existing events.

The profile streak is computed from the complete indexed sequence of UTC day numbers;
it intentionally does not count missing days. Counts and rankings remain offchain so
the check-in transaction stays the only product write.

### Production home

Run the indexer and API as two long-lived Railway services backed by one Railway
Postgres instance in the same project (or equivalent container host with persistent
Postgres). Set the environment variables below on both services, run `yarn indexer`
for the worker service and `yarn api` for the web service. Railway supplies the
persistent `DATABASE_URL`; do not use an ephemeral filesystem or an in-memory DB.
The worker is deliberately singular per contract/database to avoid duplicated RPC
backfills (event insertion is idempotent as an additional safeguard).

## Deploy the contract

The contract is standalone Solidity in `contracts/Streak.sol` and needs Solidity
0.8.24 or newer. With Foundry installed:

```bash
export BASE_RPC_URL='https://your-base-rpc'
export DEPLOYER_PRIVATE_KEY='0x...'
forge create contracts/Streak.sol:Streak \
  --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast
```

Record the printed address and its deployment block. The start block must be the
block containing deployment (or an earlier block); setting it later permanently
omits history from the derived views.

To write a check-in, call `checkIn("gm")`. A note can be empty and is capped at 280
UTF-8 bytes. The contract's day boundary is `block.timestamp / 1 days` (UTC).

## Run locally

Prerequisites: Node 20+, Docker, and a Base RPC URL with historical log access from
the contract deployment block. Public endpoints often have log-range limits, which
the indexer handles with 2,000-block chunks; a managed RPC is recommended for a
large historical deployment.

```bash
cp .env.example .env
# Edit .env: DATABASE_URL, BASE_RPC_URL, STREAK_CONTRACT_ADDRESS, STREAK_START_BLOCK
docker compose up -d postgres
yarn install
yarn indexer
```

In another terminal:

```bash
yarn api
curl http://localhost:3000/feed
curl http://localhost:3000/members/0x0000000000000000000000000000000000000000
curl http://localhost:3000/leaderboard/month
```

The indexer waits for eight confirmations by default (`INDEXER_CONFIRMATIONS`) before
persisting a block, reducing reorg risk. It is safe to restart: the cursor is updated
in the same database transaction as each block range and `(transaction_hash, log_index)`
is unique. If a deployment needs a deeper reorg policy, rewind `indexer_state.next_block`
and delete check-ins from that block before restarting.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Persistent Postgres connection string. |
| `BASE_RPC_URL` | Base mainnet JSON-RPC endpoint. |
| `STREAK_CONTRACT_ADDRESS` | Deployed `Streak` address. |
| `STREAK_START_BLOCK` | Deployment block; used for the one-time full-history backfill. |
| `INDEXER_CONFIRMATIONS` | Confirmations before indexing; defaults to 8. |
| `INDEXER_POLL_MS` | Worker polling period; defaults to 12,000. |
| `PORT` | API port; defaults to 3000. |
