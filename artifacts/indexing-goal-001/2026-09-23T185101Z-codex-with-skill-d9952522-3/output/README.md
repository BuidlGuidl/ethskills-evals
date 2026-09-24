# Streak

Streak is a daily onchain check-in app for a Base community. Members call one contract method per UTC day, optionally with a short public note. Everything shown in the product is reconstructed from the contract's `CheckIn` events, so the read side can backfill from the deployment block and include months of activity that happened before the app UI existed.

## Architecture

- `contracts/Streak.sol` is the only write surface. `checkIn(string note)` enforces one check-in per address per UTC day and emits `CheckIn(member, dayNumber, checkedAt, note, currentStreak, totalCheckIns)`.
- `src/indexer/index.ts` is the historical read side. It calls `eth_getLogs` in bounded block ranges from `STREAK_DEPLOYMENT_BLOCK`, stores every event in Postgres, keeps an `indexer_state` cursor, and then tails new finalized blocks.
- `src/api/server.ts` exposes the data needed by the three screens:
  - `GET /feed?limit=50&before=...` returns newest check-ins first.
  - `GET /members/:address` returns active current streak and all-time total check-ins.
  - `GET /leaderboard?month=YYYY-MM&limit=100` returns top members for a month.

The indexer is the production source of truth for feeds, profiles, and rankings. Do not scan logs from the frontend or inside API requests; that would miss the product requirement once history grows and RPC providers enforce log range and result limits.

## Local Setup

Requirements:

- Node.js 22+
- Docker
- Foundry
- A Base or Base Sepolia RPC URL

Install dependencies:

```bash
npm install
```

Start Postgres:

```bash
docker compose up -d postgres
```

Create `.env` from `.env.example` and fill in:

```bash
cp .env.example .env
```

For local development against an already deployed contract, set:

```bash
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
STREAK_CONTRACT_ADDRESS=0x...
STREAK_DEPLOYMENT_BLOCK=...
```

Prepare the database:

```bash
npm run db:migrate
```

Run the indexer in one terminal:

```bash
npm run indexer
```

Run the API in another terminal:

```bash
npm run api
```

The API listens on `http://localhost:8787` by default.

## Deploying the Contract

Use Base Sepolia first:

```bash
RPC_URL=https://sepolia.base.org \
DEPLOYER_PRIVATE_KEY=0x... \
npm run deploy
```

Foundry prints the deployed contract address and transaction hash. Get the receipt block from the command output or your block explorer, then put the contract address and deployment block into `.env`; the deployment block is the exact start of the complete event history.

For Base mainnet, use a mainnet Base RPC.

## Production Read Side

Run `src/indexer/index.ts` as a long-lived worker with a managed Postgres database. The worker must be started with the same `CHAIN_ID`, `STREAK_CONTRACT_ADDRESS`, and `STREAK_DEPLOYMENT_BLOCK` used by the API. A typical production setup is:

- one API service running `npm run api`;
- one worker service running `npm run indexer`;
- one managed Postgres instance with backups;
- `FINALITY_BLOCKS` set to a conservative value such as `20` for Base;
- `RPC_BLOCK_RANGE` tuned to your provider's log limits.

The indexer is restart-safe: events are keyed by `(chain_id, contract_address, transaction_hash, log_index)`, and monthly/member aggregates only update when a new event row is inserted.

## API Examples

```bash
curl http://localhost:8787/feed
curl http://localhost:8787/members/0x0000000000000000000000000000000000000000
curl "http://localhost:8787/leaderboard?month=2026-09"
```

`GET /members/:address` reports the active current streak. If a member's last check-in was today or yesterday UTC, the stored streak is active; if the last check-in is older, the API returns `0` without needing an onchain write to expire it.

## Verification

```bash
npm run contract:build
npm test
npm run typecheck
```
