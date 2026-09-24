# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members can list tools with photos and condition notes, request to borrow tools, escrow a USDC-denominated deposit, and settle late fees from that deposit when the tool comes back.

## What is included

- Vite + React + TypeScript single-page app.
- Seed data for members, tools, an active loan, and an escrow ledger.
- Local browser persistence using `localStorage`.
- Domain logic for borrower reputation, request ordering, late-day calculation, deposit refunding, and owner late-fee payout.
- Focused Vitest tests for lending settlement and reputation sorting.

## Architecture

```text
src/
  App.tsx                 Main UI and state transitions
  styles.css              Application styling
  data/seed.ts            Demo members, tools, requests, ledger entries
  domain/lending.ts       Loan request, escrow, due date, and settlement logic
  domain/reputation.ts    Borrower scoring and queue ordering
  domain/types.ts         Shared domain types
```

The app treats USDC movement as a ledger abstraction. In this version, escrow, refunds, and late-fee payouts are simulated in app state. A production version should replace that ledger adapter with wallet connection, token allowance, transfer/escrow contract calls, and transaction indexing while keeping the same domain events.

Borrower priority is calculated from completed loans, on-time rate, late returns, late days, and forfeited deposit amounts. Pending requests for a tool are sorted by that score so owners see the most reliable borrowers first.

## Run locally

```bash
npm install
npm run dev
```

Vite will print the local URL, usually `http://localhost:5173`.

Useful commands:

```bash
npm test
npm run build
npm run preview
```

## Deploy

This app builds to static assets and can be deployed to any static host.

```bash
npm install
npm run build
```

Deploy the generated `dist/` directory with a host such as Netlify, Vercel static output, Cloudflare Pages, S3 + CloudFront, or GitHub Pages. For hosts with SPA routing, configure all routes to serve `index.html`.

## Production next steps

- Replace `localStorage` with a database and authenticated member accounts.
- Add image uploads instead of photo URLs.
- Integrate wallet login and USDC escrow on the target chain.
- Add owner notifications and request expiration.
- Add admin moderation for the neighborhood association.
