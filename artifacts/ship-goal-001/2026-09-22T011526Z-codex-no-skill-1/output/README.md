# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members list tools with a photo, condition notes, USDC deposit, and daily late fee. Other members request a loan, the deposit is held, owners approve borrowers from a reliability-sorted queue, and deposits are settled when the tool comes back.

## Run Locally

Requirements:

- Node.js 20 or newer

```bash
npm install
npm start
```

Open `http://localhost:3000`.

There are no runtime npm dependencies yet. The first run copies `data/seed.json` into `data/toolshed-db.json`; that database file is intentionally local runtime state. Delete `data/toolshed-db.json` to reset the demo data.

## Product Scope

This version supports:

- Member switching for demo and local testing.
- Tool listings with owner, category, photo URL, condition notes, deposit, and late fee.
- Borrow requests that immediately lock the deposit from the borrower balance.
- Owner request review sorted by borrower reliability score.
- Request approval that creates an active loan and releases competing pending deposits.
- Request rejection that releases the held deposit.
- Return settlement with late-day calculation, borrower refund, and owner late-fee payout.
- Member track records based on completed loans, late returns, active loans, and pending requests.

USDC is represented as an application ledger balance in this first version. A production smart-contract or payment-provider integration can replace the ledger while keeping the same request and settlement lifecycle.

## Architecture

```text
src/
  server/
    index.js   HTTP server, API routing, static file serving
    store.js   JSON persistence, validation helpers, reliability scoring
  public/
    index.html Browser UI shell
    styles.css Interface styling
    app.js     Client rendering and API calls
data/
  seed.json    Starter members, tools, requests, and loans
```

The server uses Node's built-in `http` module and writes JSON state to `data/toolshed-db.json`. The browser client calls `/api/state` and mutation endpoints under `/api/*`, then re-renders from the returned state.

Important domain rules live on the server:

- A borrower cannot request their own tool.
- A request can only be made for an available tool.
- The borrower must have enough USDC balance for the deposit.
- Only the owner can approve, reject, or settle a loan for their tool.
- Late fees are `late days * daily late fee`, capped at the deposit.
- Reliability score is computed from borrower history, with late returns penalized.

## API

- `GET /api/state` returns members, tools, requests, loans, and computed metrics.
- `POST /api/tools` lists a new tool.
- `POST /api/requests` creates a borrow request and locks the deposit.
- `POST /api/requests/:id/approve` approves a request and creates a loan.
- `POST /api/requests/:id/reject` rejects a request and refunds the deposit.
- `POST /api/loans/:id/return` marks a loan returned and settles deposit funds.

## Deployment

Toolshed can run anywhere that supports a long-running Node process and a writable filesystem.

1. Set the Node version to 20 or newer.
2. Copy the repository to the server.
3. Run `npm install`.
4. Start with `PORT=3000 npm start`.
5. Put a reverse proxy such as Nginx, Caddy, Fly.io, Render, or Railway in front of the process for HTTPS.
6. Persist the `data/` directory so `toolshed-db.json` survives restarts.

For a production deployment, replace JSON-file persistence with Postgres or SQLite, add authentication for the roughly 300 association members, and integrate a real USDC escrow flow. The current server-side API boundaries are intentionally small so those pieces can be swapped in without rewriting the browser UI.

## Development Notes

Useful commands:

```bash
npm run dev
npm run check
```

Keep source files under `src/` and seed data under `data/`. Do not put hand-written files under `lib/`, `dist/`, `build/`, or `out/`; those names are reserved for generated output in this workspace.
