# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members can list tools, request to borrow tools, escrow a USDC deposit, approve or decline requests, return borrowed tools, and build a reputation record that prioritizes reliable borrowers.

## Architecture

- `src/shared` contains types and USDC helpers used by both the browser and server. USDC is stored as integer micro-USDC, matching the token's 6 decimal places.
- `src/server` is an Express API. The domain layer owns lending rules: request escrow, owner approval, request decline refunds, return settlement, late-fee calculation, and reputation scoring.
- `src/client` is a Vite + React app. It provides the browse, list-tool, loan queue, return, wallet, and member reputation screens.
- `storage/toolshed.dev.json` is created on first run from seed data. It is intentionally gitignored local state.

The v1 app models USDC deposits in the application ledger so developers can run the product locally without a wallet, RPC endpoint, or smart contract. The domain layer is isolated so an on-chain escrow adapter can replace the file-backed wallet mutations later.

## Local Development

Requirements:

- Node.js 20+
- npm 10+

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:5175`. Vite serves the UI and proxies `/api` to the Express server on `http://localhost:5174`.

Useful scripts:

```bash
npm run test
npm run typecheck
npm run build
npm start
```

## Configuration

Environment variables:

- `PORT`: HTTP port. Defaults to `5173`.
- In development the API defaults to `5174`; in production the app defaults to `5173`.
- `NODE_ENV`: set to `production` when running a built app.
- `TOOLSHED_DATA_PATH`: JSON data file path. Defaults to `storage/toolshed.dev.json`.

To reset local data, stop the server and delete the configured data file. The next run will recreate it from `src/server/seed.ts`.

## API

- `GET /api/state`: returns members, tools, loans, wallets, and computed reputation.
- `POST /api/tools`: list a tool.
- `POST /api/loans`: request a tool and move the deposit into escrow.
- `POST /api/loans/:loanId/approve`: owner approval; tool becomes borrowed.
- `POST /api/loans/:loanId/decline`: owner decline; deposit is refunded.
- `POST /api/loans/:loanId/return`: borrower return; late fee is paid from escrow and the rest is refunded.

## Reputation and Sorting

Each member has `completedLoans` and `lateReturns`. The server computes:

```text
onTimeReturns = completedLoans - lateReturns
reliabilityScore = onTimeReturns * 10 + min(completedLoans, 20) - lateReturns * 15
```

Browse lists available tools first, then sorts by owner reliability. Incoming loan requests are sorted by borrower reliability so owners see the strongest borrower track records first.

## Deployment

Build the app:

```bash
npm run build
```

Run the built server:

```bash
NODE_ENV=production PORT=8080 TOOLSHED_DATA_PATH=/var/toolshed/toolshed.json npm start
```

The production server serves `dist/client` and the API from one Node process. For a small neighborhood deployment, run this behind a TLS-terminating reverse proxy such as Caddy, Nginx, Fly.io, Render, Railway, or a container platform.

Persistence for v1 is a single JSON file. Put `TOOLSHED_DATA_PATH` on a durable volume and include it in backups. Before using Toolshed for real deposits, replace the file-backed wallet ledger with a USDC escrow integration and add authentication so only the signed-in owner or borrower can take loan actions.
