# Streak

A daily onchain check-in app for a community on Base.

One write: a member sends a check-in transaction once per UTC day, optionally with a short
public note. Three reads: a global feed, a member profile (current streak + all-time total),
and a monthly leaderboard.

This repo contains the contract and the read side that backs those three screens.

```
contracts/   Foundry project — Streak.sol, tests, deploy script
indexer/     Ponder indexer — event handlers, database schema, HTTP/GraphQL API
scripts/     ABI sync + a local seeder that back-dates ~4 months of check-ins
```

## Architecture

```
  member wallet
      │  checkIn("gm")
      ▼
  Streak.sol on Base ──── emits CheckedIn(member, day, streak, total, note)
      │
      │  logs, from the deployment block onwards
      ▼
  Ponder indexer  ──►  Postgres   check_in / member / member_month
      │
      │  HTTP + GraphQL
      ▼
  feed screen   profile screen   leaderboard screen
```

### Why an indexer, and not direct contract reads

The launch condition in the brief is the design constraint: **the contract already has months
of history before anyone opens the app.** Every screen has to reflect the whole record.

- The **feed** is cross-member and historical. A contract can't return "the last 50 check-ins
  across everyone" — that would mean storing and paging an unbounded array onchain. It lives in
  the log, and the log needs to be collected somewhere queryable.
- The **leaderboard** is a `GROUP BY member` over a month of events. No contract read does that,
  and no wallet is going to pay to maintain a sorted monthly ranking onchain.
- Doing it client-side with `eth_getLogs` at page load means every visitor re-scans months of
  blocks on every load: slow, rate-limited, and it gets worse every day the contract lives.

So the app reads from a database that is built by replaying the contract's entire log history
once, and then kept current block by block. `startBlock` in `indexer/ponder.config.ts` is the
deployment block — not "now" — so a fresh indexer backfills from day one before the API reports
itself ready. Reindexing from scratch is always possible because the chain, not the database, is
the source of truth.

The contract still carries enough state to enforce its own rules (one check-in per day) and to
emit a trustworthy streak/total with each event, so the indexer never has to re-derive them and
can be verified against `memberOf(address)` at any time.

### What each screen queries

| Screen | Endpoint | Table | Access pattern |
| --- | --- | --- | --- |
| Global feed | `GET /feed` | `check_in` | keyset scan on `(blockNumber, logIndex) DESC` |
| Member profile | `GET /members/:address` | `member` (+ `check_in` for recents) | primary-key lookup |
| Leaderboard | `GET /leaderboard?month=YYYY-MM` | `member_month` | index on `(month, checkIns)` |

All three are O(page size) — none of them scan history at request time. History is folded into
the aggregate tables once, at index time, by `indexer/src/index.ts`.

### Time and streak semantics

- A "day" is a UTC day: `block.timestamp / 86400`. The contract stores it as a `uint32` day
  index and emits it, so the indexer and the contract can never disagree about which day a
  check-in belongs to.
- `Member.streak` onchain is the streak **as of the last check-in**. It is deliberately not
  decayed onchain — nothing happens onchain when a member simply stops showing up.
- The live "current streak" a profile shows is derived at read time: the streak counts if the
  member checked in today or yesterday, otherwise it is `0`. Both `Streak.currentStreak()` and
  the API's `liveStreak()` implement exactly that rule.
- The leaderboard month is a UTC calendar month (`YYYY-MM`), matching the day index.

## Contract

`contracts/src/Streak.sol`

```solidity
function checkIn(string calldata note) external;   // the only write; reverts if already checked in today
event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);
```

Notes are capped at 140 bytes (`MAX_NOTE_BYTES`) to keep calldata and log size bounded; pass `""`
for no note. Views: `memberOf`, `currentStreak`, `totalOf`, `canCheckIn`,
`secondsUntilNextCheckIn`, `today`, `totalCheckIns`, `totalMembers`, `deployDay`. These exist for
wallets and for spot-checking the indexer; the app's screens do not depend on them.

Errors: `AlreadyCheckedInToday(uint32 day)`, `NoteTooLong(uint256 length, uint256 max)`.

Run the tests:

```bash
npm run test:contracts     # forge test --root contracts
```

## Read-side API

`ponder dev`/`ponder start` serves on `http://localhost:42069`.

### `GET /feed`

Newest-first global feed. `limit` (default 50, max 200), `cursor` (opaque, from `nextCursor`),
optional `member=0x…` filter. Keyset pagination — stable and O(1) regardless of depth.

```json
{
  "items": [
    {
      "id": "0xaadf…-6",
      "member": "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
      "note": "shipped the docs",
      "timestamp": 1790243940,
      "day": 20720,
      "streak": 3,
      "memberTotal": 82,
      "transactionHash": "0xaadf…",
      "blockNumber": "122",
      "cursor": "122:6"
    }
  ],
  "nextCursor": "122:4"
}
```

### `GET /members/:address`

```json
{
  "address": "0xf39f…2266",
  "currentStreak": 29,
  "longestStreak": 58,
  "totalCheckIns": 118,
  "checkedInToday": true,
  "firstCheckInAt": 1779958800,
  "lastCheckInAt": 1790243940,
  "lastNote": "day off from code, still here",
  "thisMonthCheckIns": 24,
  "recent": [ /* last N check-ins, same shape as /feed items */ ]
}
```

Unknown addresses return a zeroed profile rather than a 404, so the screen has something to
render for a member who has never checked in.

### `GET /leaderboard`

`month=YYYY-MM` (defaults to the current UTC month), `limit` (default 25, max 200), `offset`.
Ordered by check-ins desc, ties broken by who reached the count first.

```json
{
  "month": "2026-09",
  "entries": [
    { "rank": 1, "member": "0xf39f…2266", "checkIns": 24, "currentStreak": 29, "totalCheckIns": 118, "lastCheckInAt": 1790243940 }
  ]
}
```

### Also available

- `GET /stats` — total check-ins, distinct members, check-ins today.
- `POST /graphql` — auto-generated GraphQL over all three tables (`ponder`'s `graphql()`).
- `/sql/*` — typed SQL over HTTP for `@ponder/client` frontends.
- `GET /ready` — 200 only once the historical backfill is complete. Use it as the deploy gate
  and load-balancer readiness probe so traffic never hits a half-backfilled database.
- `GET /status` — per-chain indexed block height.

## Running it locally

Prerequisites: Node ≥ 22, [Foundry](https://getfoundry.sh). No database needed for local dev —
Ponder uses an embedded PGlite.

```bash
npm install

# terminal 1 — a local chain, back-dated so we can write months of history into it
npm run anvil

# terminal 2 — deploy Streak and seed ~120 days of check-ins from 8 members
npm run seed

# terminal 2 — index that history and serve the API
npm run dev
```

`npm run seed` writes `indexer/.env.local` with the deployed address and the deployment block, so
`npm run dev` picks them up with no further setup. It mines one block per simulated day, gives
each account a different attendance rate (account 0 is near-perfect), and is deterministic, so
reruns produce the same history. `SEED_DAYS` and `SEED_MEMBERS` override the defaults.

Then:

```bash
curl 'localhost:42069/feed?limit=3'
curl 'localhost:42069/members/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
curl 'localhost:42069/leaderboard?limit=5'
curl 'localhost:42069/leaderboard?month=2026-08'
```

To watch the live path, send a check-in from an account the seeder didn't use and re-query the
feed a few seconds later:

```bash
cast send $(grep STREAK_ADDRESS indexer/.env.local | cut -d= -f2) "checkIn(string)" "late to the party" \
  --mnemonic "test test test test test test test test test test test junk" --mnemonic-index 9 \
  --rpc-url http://127.0.0.1:8545
```

## Deploying

### 1. Contract

```bash
export BASE_RPC_URL=https://mainnet.base.org      # or your provider
export PRIVATE_KEY=0x…                            # deployer key
export BASESCAN_API_KEY=…

npm run deploy -- --rpc-url base --private-key $PRIVATE_KEY --broadcast --verify
```

The script prints the deployed address and the block number — both go straight into the
indexer's env. (Use `--rpc-url base_sepolia` for testnet; see `contracts/foundry.toml`.)

### 2. Indexer

```bash
npm run abi                      # sync indexer/abis/StreakAbi.ts from the compiled artifact
cp indexer/.env.example indexer/.env.local   # then fill in the values below
npm run start --workspace indexer
```

| Variable | Purpose |
| --- | --- |
| `PONDER_RPC_URL` | Base RPC. Must serve `eth_getLogs` over the full history — use a paid provider or your own node; the public endpoint rate-limits during backfill. |
| `CHAIN_ID` | `8453` (Base), `84532` (Base Sepolia), `31337` (anvil). |
| `STREAK_ADDRESS` | Deployed contract address. |
| `STREAK_START_BLOCK` | Deployment block, from the deploy script. Do not set this to "recent" — that is exactly how you lose history. |
| `DATABASE_URL` | Postgres connection string. Required in production; omit locally for PGlite. |
| `DATABASE_SCHEMA` | Postgres schema for this deployment, e.g. `streak_prod_v3`. |

Deploy flow for a new version: start the new instance against a **new** `DATABASE_SCHEMA`, wait
for `GET /ready` to return 200 (the backfill has replayed all of history into the new schema),
then cut traffic over. The old schema can be dropped afterwards. This is also what you do after
any change to `ponder.schema.ts` or `src/index.ts` — the read model is a pure function of the
log, so rebuilding it is always safe, just time-consuming.

Ponder handles reorgs itself: it tracks finality and reverts indexed rows for orphaned blocks, so
Base's occasional short reorgs don't leave phantom check-ins in the feed.

### Operational notes

- **Backfill cost.** One event type, one contract, a few hundred to a few thousand logs per
  month. A backfill of a year of history is minutes, not hours, on a decent RPC. Ponder caches
  fetched logs on disk, so restarts during development don't re-fetch.
- **Scaling reads.** The API is stateless over Postgres; run several instances behind a load
  balancer pointed at one indexer's schema, or use Ponder's read-only API mode.
- **Verifying the index.** Every aggregate the API serves can be checked against the contract:
  `cast call $STREAK "memberOf(address)" $MEMBER --rpc-url $BASE_RPC_URL` should match
  `totalCheckIns` / `longestStreak` / `lastDay` on `GET /members/:address`.

## Layout and conventions

- `contracts/` — Foundry. Source in `src/`, tests in `test/`, deploy script in `script/`.
  `out/`, `cache/` and `lib/` are generated by `forge`.
- `indexer/` — Ponder. `ponder.schema.ts` (tables), `ponder.config.ts` (chain + contract),
  `src/index.ts` (the single event handler that builds all three read models),
  `src/api/index.ts` (the HTTP API). `abis/StreakAbi.ts` is generated by `npm run abi`.
- `scripts/` — `generate-abi.mjs` (keeps the indexer ABI in lockstep with the compiled contract),
  `seed-local.mjs` (local history generator).

## What this repo does not include

No frontend. The three screens are backed by the endpoints above (plus GraphQL and `/sql` for a
typed client), but the UI itself is out of scope. Likewise there's no auth, rate limiting, or
ENS/avatar resolution on the API — put those in front of it or in the frontend's data layer.
