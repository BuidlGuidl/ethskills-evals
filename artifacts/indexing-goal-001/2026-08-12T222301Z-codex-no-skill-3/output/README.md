# Streak

Daily onchain community check-ins on Base. `Streak.sol` permits one transaction per
address per UTC day and emits the member, day, and optional public note. A resumable
indexer backfills every `CheckedIn` event from the deployment block into SQLite,
then an HTTP API serves the feed, profiles, and monthly leaderboard.

## Architecture

- `contracts/Streak.sol`: minimal write path; notes are capped at 280 UTF-8 bytes.
- `src/indexer.ts`: scans `[START_BLOCK, confirmed head]` in chunks, persists a cursor
  transactionally with idempotent event inserts, and resumes after restarts. The API
  does **not** listen only from startup: initial backfill finishes before it accepts
  traffic, so months of pre-launch history are included. Ten confirmations avoid
  normal short reorgs; restart from a suitably earlier cursor/database if a deeper
  Base reorg occurs.
- `src/queries.ts`: keyset-paginated global feed; current consecutive UTC-day streak
  plus all-time count; UTC calendar-month ranking. Addresses are normalized lowercase.
- `src/server.ts`: dependency-light JSON HTTP service. SQLite is suitable for one
  service instance; use Postgres and a single elected indexer for horizontal scale.

The contract event is the canonical record. The database is disposable and can be
rebuilt from `START_BLOCK`. Configure that value to the exact deployment block:
using a later block silently omits history; using an earlier one is safe but slower.

## Deploy to Base

Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:

```sh
forge test
export BASE_RPC_URL=https://mainnet.base.org
export PRIVATE_KEY=... # use a deployment key; never commit it
forge create contracts/Streak.sol:Streak --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY"
```

Record the returned contract address and deployment block. Test on Base Sepolia first
by using its RPC URL (and change `base` to `baseSepolia` in `src/indexer.ts` while
testing; production explicitly pins Base chain ID 8453).

## Run locally

Requires Node 20+ and a Base archive-capable RPC that serves logs back to deployment.

```sh
cp .env.example .env
# edit CONTRACT_ADDRESS, START_BLOCK, and RPC_URL
npm install
set -a; . ./.env; set +a
npm test
npm start
```

Startup may take time on a long history; progress is durable in `data/streak.sqlite`.
Routes:

```text
GET /api/feed?limit=50&beforeBlock=123&beforeLog=4
GET /api/members/0x...
GET /api/leaderboard?month=2026-08
GET /health
```

For the next feed page, pass the last row's `blockNumber` and `logIndex`. Counts are
at most one per member/day because the contract enforces that invariant. Run
`npm run typecheck` for the TypeScript check.
