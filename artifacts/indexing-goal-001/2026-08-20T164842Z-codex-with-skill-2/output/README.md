# Streak for Base

Streak is a daily onchain check-in for a Base community. A member calls `checkIn(note)` once per UTC day; the contract emits one event containing every field the read side needs. The event history—not a browser-local cache or an RPC log scan—is the source for the three views.

## Architecture

```text
member wallet
    │ checkIn(note)
    ▼
Streak.sol on Base ── CheckIn(member, day, note, timestamp) ──► Ponder indexer + Postgres
                                                               │
                                                               ├─ check_in: newest-first global feed
                                                               ├─ member: current streak + total
                                                               └─ monthly_member: calendar-month counts/ranking
                                                                        │
                                                                        ▼
                                                                  Ponder GraphQL API → app UI
```

`indexer/` is a Ponder read service. Its production home is a **Railway service with a Railway Postgres database**: deploy the supplied Dockerfile as a long-running service, give it a persistent `DATABASE_URL`, and set the environment variables below. This matters: Ponder begins at the contract deployment block, performs one historical backfill into Postgres, then follows new Base blocks. No screen request scans contract history or depends on when a visitor first opened the app.

The check-in transaction is the only application write. The contract limits notes to 280 bytes and uses `block.timestamp / 1 days`, so “day” means a UTC calendar day. It prevents an address from checking in twice in that day. The indexer derives streaks from monotonically processed event days: consecutive day increments the streak; any gap resets it to one. Every event increments the all-time and that calendar month's count.

## Contract deployment

Requirements: Foundry, a funded Base deployer, and a Base RPC URL.

```bash
cd contracts
forge test
forge create src/Streak.sol:Streak \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

Record the emitted address and the deployment transaction's exact Base block number. That block—not the current block—is the indexer's `START_BLOCK`; it is what makes the launch include months of prior check-ins.

## Run the indexed read side locally

Requirements: Node 22+, pnpm 9+, Docker, and a Base RPC endpoint capable of serving the initial backfill.

```bash
docker compose up -d postgres
cp indexer/.env.example indexer/.env
# Edit indexer/.env: STREAK_ADDRESS and START_BLOCK are required.
pnpm --dir indexer install
pnpm --dir indexer dev
```

Ponder starts its local GraphQL/API server and creates the tables in Postgres. For a deployed contract with existing history, first startup can take time while it backfills; leave the service running until it reaches the chain head before treating the feed as live. Subsequent restarts resume from its stored sync state.

Use a paid/dedicated Base RPC endpoint for production backfill and tailing; public endpoints may cap log ranges or rate-limit the initial historical sync.

## Screen queries

The application talks only to the indexer's API. The ready-to-use operation strings are in [indexer/src/query-documents.ts](indexer/src/query-documents.ts). They map directly to the screen requirements:

| Screen | Indexed data | Ordering / calculation |
| --- | --- | --- |
| Global feed | `check_in` | descending `timestamp`, cursor/offset pagination |
| Member profile | `member` | stored `currentStreak`, `totalCheckIns` |
| Monthly leaderboard | `monthly_member` | filter `month` as `YYYY-MM`, descending `checkIns` |

For ties in the leaderboard, the UI should apply a stable secondary sort by lowercase wallet address. Use the month from the user's selected UTC date (`new Date().toISOString().slice(0, 7)` for “this month”). Addresses are normalized to lowercase by the indexer.

## Production deployment (Railway)

1. Create a Railway project and add a PostgreSQL service.
2. Create a service from this repository, use `indexer/Dockerfile`, and attach the Postgres service's `DATABASE_URL`.
3. Set `PONDER_RPC_URL`, `STREAK_ADDRESS`, and `START_BLOCK` in Railway. Never change `START_BLOCK` to a later block after launch; that would omit the earlier record.
4. Deploy it and wait for the initial sync to reach Base head. Put the service's API URL behind the community app, keeping any API credentials server-side if enabled.
5. Monitor indexer lag and database disk. Back up Postgres; it contains the persistent read model and sync checkpoint.

`CheckIn` deliberately carries note, member, timestamp, and day in its log. Adding future writes requires adding similarly complete events and handlers, since state changes without events are invisible to this read side.
