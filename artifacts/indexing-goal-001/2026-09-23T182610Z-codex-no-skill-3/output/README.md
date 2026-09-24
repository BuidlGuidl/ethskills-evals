# Streak

Streak is a daily onchain check-in app for a community on Base. Members call one contract function per UTC day, optionally attaching a short public note. Everything the product shows is derived from the complete `CheckIn` event history, starting at the contract deployment block.

## Architecture

- `contracts/StreakCheckIn.sol` is the only write surface. `checkIn(string note)` enforces one check-in per address per UTC day, caps notes at 160 bytes, updates simple onchain counters, and emits `CheckIn(member, day, note)`.
- `src/indexer.ts` replays all `CheckIn` logs from `STREAK_START_BLOCK` to the latest confirmed block, persists them, stores a durable cursor, and keeps polling for new logs.
- `src/db.ts` stores the read model in a durable JSON file and serves the three product views from the replayed history.
- `src/server.ts` exposes the read API for the screens and can run the indexer in the same process for local development.
- `scripts/deploy.ts` compiles and deploys the contract with `solc` and `viem`.

The read side intentionally does not depend on page-opened state or browser sessions. On a fresh launch, it backfills the entire contract history before and during operation, so months of previous check-ins are reflected in the feed, streaks, and leaderboard.

## Product Screens and API

### Global Feed

`GET /feed?limit=50&before=<blockNumber>:<logIndex>`

Returns newest check-ins first:

```json
{
  "items": [
    {
      "member": "0x...",
      "date": "2026-09-23",
      "note": "gm",
      "blockNumber": 123,
      "transactionHash": "0x...",
      "checkedInAt": "2026-09-23T12:00:00.000Z"
    }
  ]
}
```

For a live feed, use `GET /feed/stream`. It sends an initial `snapshot` event and then `check_in` events as newly indexed logs arrive.

### Member Profile

`GET /members/:address`

Returns a member's current streak and all-time total check-ins. A streak is considered current if the member checked in today or yesterday in UTC; after a full missed UTC day, it drops to zero.

### Monthly Leaderboard

`GET /leaderboard/month?month=YYYY-MM&limit=100`

Returns the top members for the requested UTC month by check-in count. Ties are ordered by most recent check-in, then address.

### Health

`GET /healthz`

Returns the latest block the indexer has durably scanned.

## Local Development

Install dependencies:

```sh
npm install
```

Create an environment file:

```sh
cp .env.example .env
```

For local API development against an already deployed contract, fill in:

```sh
RPC_URL=https://mainnet.base.org
STREAK_CONTRACT_ADDRESS=0x...
STREAK_START_BLOCK=<deployment block>
DATABASE_PATH=./data/streak.json
PORT=3000
```

Run the API and indexer together:

```sh
npm run dev
```

Run only the indexer:

```sh
npm run index
```

Run the type check and tests:

```sh
npm run build
npm test
```

## Deploying to Base

Set deploy environment variables:

```sh
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
PRIVATE_KEY=0x...
```

Deploy:

```sh
npm run deploy
```

The script prints:

- `StreakCheckIn deployed at`, which becomes `STREAK_CONTRACT_ADDRESS`
- `Deployment block`, which becomes `STREAK_START_BLOCK`

Use those exact values for the indexer. The deployment block is important: it is how the read side knows where the complete historical record begins.

For Base Sepolia testing, use a Base Sepolia RPC URL and `CHAIN_ID=84532`.

## Operational Notes

- `INDEX_CONFIRMATIONS` defaults to `2`, so the API trails the chain tip slightly to reduce reorg risk.
- `INDEX_CHUNK_SIZE` defaults to `2000` blocks. Lower it if your RPC provider has strict log range limits.
- Check-ins are idempotently stored by `(tx_hash, log_index)` and by `(member, day)`.
- Generated files are written to ignored runtime folders such as `data/` and `artifacts/`; source code lives in `contracts/`, `src/`, `scripts/`, and `test/`.
