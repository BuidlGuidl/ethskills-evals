# Streak

Streak is a daily onchain check-in app for a Base community. Members write one transaction per UTC day with an optional short public note. Everything the product reads comes from the `CheckedIn` event, so the feed, member profiles, and monthly leaderboard can be rebuilt from the contract's full history.

## Architecture

- `contracts/StreakCheckIn.sol` is the only write surface. `checkIn(string note)` rejects duplicate same-day check-ins and emits `CheckedIn(member, day, timestamp, note)`.
- `src/indexer.ts` is the historical read side. It backfills `CheckedIn` logs from `START_BLOCK` into Postgres, advances a durable `last_indexed_block`, and then tails new Base blocks.
- `read-model/schema.sql` stores the global feed plus derived tables for member totals/current streaks and monthly counts.
- `src/server.ts` exposes the three screen APIs:
  - `GET /feed?limit=50&cursor=blockNumber:logIndex`
  - `GET /feed/stream` for live Server-Sent Events
  - `GET /members/:address`
  - `GET /leaderboard/month?month=YYYY-MM&limit=50`

Historical data is indexed once into Postgres, not scanned from RPC at request time. In production, run `npm run start:indexer` as a long-lived worker service with a persistent Postgres database and a Base RPC provider. Run `npm run start:api` as the public web service against the same database.

## Contract Deployment

Install dependencies, then test the contract:

```bash
npm install
npm run contracts:deps
npm run contracts:test
```

Deploy to Base Sepolia or Base mainnet with Foundry:

```bash
export PRIVATE_KEY=...
export BASE_RPC_URL=...

forge script contracts/script/DeployStreakCheckIn.s.sol \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify
```

Record the deployed contract address and the deployment block. The deployment block is the `START_BLOCK` for the indexer; it is how Streak reconstructs months of existing check-ins before serving launch traffic.

## Local Development

Start Postgres:

```bash
docker compose up -d postgres
```

Create an environment file:

```bash
cp .env.example .env
```

Set `CONTRACT_ADDRESS` and `START_BLOCK` in `.env`. Use Base Sepolia values while testing. Then run the API and indexer in separate terminals:

```bash
npm run dev:api
npm run dev:indexer
```

The API listens on `http://localhost:3000`.

Example requests:

```bash
curl http://localhost:3000/health
curl 'http://localhost:3000/feed?limit=20'
curl http://localhost:3000/members/0x0000000000000000000000000000000000000000
curl 'http://localhost:3000/leaderboard/month?month=2026-09'
```

## Production Notes

- Run `src/indexer.ts` as a single worker process per contract. It owns backfill and block tailing.
- Use managed Postgres or an equivalently durable database. Do not use an in-memory store for the read model.
- Set `CONFIRMATIONS` high enough for your reorg tolerance. The default is `6`.
- If the contract is redeployed, start a fresh database or clear the read model and set the new deployment block.
- If a deep reorg passes the confirmation window, rebuild the read model from `START_BLOCK`.

## Verification

```bash
npm run typecheck
npm test
npm run contracts:test
```
