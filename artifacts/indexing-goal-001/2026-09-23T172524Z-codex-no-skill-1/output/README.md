# Streak

Streak is a daily onchain check-in app for a Base community. Members make one write: `checkIn(note)`. Everything the product reads, including launch-day history, is rebuilt from the contract event log.

## Architecture

- `contracts/Streak.sol` enforces one check-in per address per UTC day and emits `CheckIn(member, day, totalCheckIns, streakAtCheckIn, note)`.
- `src/read-model/indexer.ts` backfills every `CheckIn` event from `STREAK_START_BLOCK` through the latest confirmed block, then keeps polling for new logs.
- `src/read-model/store.ts` persists the derived read model in `.streak-data/read-model.json` by default. It serves newest-first feed rows, member profiles, and monthly leaderboard rows.
- `src/read-model/server.ts` exposes the API and serves `web/`, a small three-screen UI for the feed, profile lookup, and monthly leaderboard.

The read side is deliberately event-sourced. If the app launches months after the contract, set `STREAK_START_BLOCK` to the deployment block and the first sync will index the complete history instead of only watching new activity.

## API

- `GET /api/feed?limit=50` returns recent check-ins, newest first.
- `GET /api/members/:address` returns `currentStreak`, all-time `totalCheckIns`, and last check-in metadata.
- `GET /api/leaderboard/monthly?year=2026&month=9&limit=50` returns top members for a UTC calendar month. `year` and `month` default to the current UTC month.
- `GET /api/health` returns sync status and the indexed cursor block.

## Local Setup

Install [Foundry](https://book.getfoundry.sh/getting-started/installation) for contract build, test, and deployment commands. Then install the Node dependencies for the read side:

```bash
npm install
cp .env.example .env
npm test
npm run test:contracts
```

For a local chain, deploy the contract and point the read side at that deployment:

```bash
RPC_URL=http://127.0.0.1:8545 \
DEPLOYER_PRIVATE_KEY=0x... \
npm run deploy:base
```

Copy the printed contract address and deployment block into `.env`:

```bash
RPC_URL=http://127.0.0.1:8545
STREAK_CONTRACT_ADDRESS=0x...
STREAK_START_BLOCK=123
STREAK_CONFIRMATIONS=0
```

Then run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Base Deployment

1. Fund the deployer on Base or Base Sepolia.
2. Set `RPC_URL` to the target Base RPC endpoint.
3. Set `DEPLOYER_PRIVATE_KEY` in your local environment.
4. Run `npm run deploy:base`.
5. Save the printed contract address and deployment block.
6. Run the read side with `STREAK_CONTRACT_ADDRESS` and `STREAK_START_BLOCK` set to those values.

The deploy script uses Foundry. Generated contract output goes to ignored `out/`, `cache/`, and `broadcast/` folders.

## Operating Notes

- Streak days are UTC days: `floor(block.timestamp / 1 days)`.
- A streak is considered current through the day after the most recent check-in. If a member checked in yesterday, they still have an active streak today.
- Notes are capped at 160 bytes onchain.
- The read model file is derived data. It can be deleted and rebuilt from Base as long as `STREAK_START_BLOCK` is correct.
- Increase `STREAK_BATCH_SIZE` for faster backfills on RPCs that allow large log ranges; lower it if your RPC provider limits `eth_getLogs`.
