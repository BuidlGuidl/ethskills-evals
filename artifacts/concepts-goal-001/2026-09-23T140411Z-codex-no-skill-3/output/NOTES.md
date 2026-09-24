# Weather API Onchain Billing Notes

## What Is Deployed

`UsdSubscriptionVault` is a prepaid USDC subscription vault with two fixed plans:

- Hobby: `5_000_000` USDC units, equal to $5.00 for a 6-decimal USDC token.
- Pro: `20_000_000` USDC units, equal to $20.00.
- Billing period: `30 days`.

Customers approve USDC, call `deposit` or `depositFor`, then call `selectPlan(1)` for Hobby or `selectPlan(2)` for Pro. The first month is reserved immediately. Revenue vests linearly over the month, so if a customer cancels mid-period, `cancel` refunds their uncommitted credit plus the unearned portion of the current month.

## Deploying

This repo uses Foundry.

```bash
npm run build
npm test

RPC_URL="https://..." \
PRIVATE_KEY="0x..." \
USDC_ADDRESS="0x..." \
OWNER_ADDRESS="0x..." \
TREASURY_ADDRESS="0x..." \
npm run deploy
```

Use the canonical USDC address for the chain you deploy to. The contract assumes USDC-style 6-decimal accounting because the plan prices are fixed in USDC base units.

## Backend Check

For each API request, map the incoming API key/session to the customer's wallet address and call:

```solidity
isSubscribed(address customer) returns (bool)
```

That view accounts for lazy renewals. If the current prepaid period expired but the customer has enough deposited credit for the next month or months, it still returns `true`.

For richer diagnostics, call `subscriptionStatus(address)`. It returns whether the customer is subscribed, selected plan, current/virtual coverage, uncommitted credit, unearned current-period amount, and the refund they would get if they canceled at the current block timestamp.

## Day-To-Day Operations

Run a small cron or keeper that calls `settleMany(address[])` for active customers, ideally daily and always before withdrawing revenue. Settlement:

- Accrues earned revenue from the current billing period.
- Reserves the next month from customer credit when a paid period ends.
- Marks subscriptions lapsed when there is not enough credit for renewal.

The API backend can rely on `isSubscribed` for request gating, but regular settlement keeps accounting fresh, emits useful events, and prevents long catch-up loops.

Withdraw earned funds with `withdrawAllRevenue()` or `withdrawRevenue(to, amount)`. Only earned revenue can be withdrawn; unearned customer prepayments remain in the contract so cancellation refunds can be paid.

## Customer Flows

- Top up: customer approves USDC, then calls `deposit(amount)`.
- Start or change plan: customer calls `selectPlan(1)` or `selectPlan(2)`. Mid-period changes apply to the next renewal; the current period keeps its original charge.
- Withdraw extra credit: customer calls `withdrawCredit(amount)` for uncommitted deposited funds.
- Cancel: customer calls `cancel()` and receives uncommitted credit plus any unearned current-period amount.
- Resume after lapse: customer deposits enough USDC and calls `selectPlan(planId)` again.

## Things To Watch

- Settlement cadence: if nobody calls `settle` or `settleMany` for a long time, a heavily funded account may need many monthly renewals processed in one transaction. Daily settlement avoids this.
- USDC address and chain risk: deploy with the canonical USDC token for the selected network. Do not use bridged or wrapped tokens unless that is intentional.
- Treasury hygiene: keep `owner` as a multisig or operational admin wallet, and set `treasury` to the wallet that should receive earned revenue.
- Revenue timing: the contract intentionally vests revenue over time instead of letting the service withdraw a full month immediately. This protects customer cancellation refunds.
- Pricing rigidity: plan prices and the 30-day period are constants. Deploy a new contract if you need different prices, annual plans, coupons, or usage-based metering.
- Backend identity: the contract only knows wallet addresses. Your API service still needs a reliable mapping from API keys to addresses and should decide whether delegated/team API keys are allowed.
- Production readiness: get an independent security review before holding meaningful customer balances.
