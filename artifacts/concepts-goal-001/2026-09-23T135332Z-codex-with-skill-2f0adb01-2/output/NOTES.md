# WeatherBilling Notes

## Model

Customers approve USDC, call `topUp` or `topUpFor`, then call `startSubscription` with `Hobby` or `Pro`. The contract treats the plans as prepaid balances draining at fixed monthly rates:

- Hobby: `5_000_000` USDC units per 30 days.
- Pro: `20_000_000` USDC units per 30 days.

There is no automatic monthly job onchain. Fees accrue in views as time passes, and become withdrawable for the provider when someone calls `settle(account)`, when the customer changes plan, or when the customer cancels. This keeps backend authorization cheap while still requiring real transactions to move money.

## Backend Check

For each API request, call `isSubscribed(customerAddress)`.

For richer account data, call `getAccount(customerAddress)`. `availableBalance` and `paidUntilTimestamp` are computed from the current block timestamp, so they reflect unpaid-but-accrued usage even if nobody has called `settle` recently.

Recommended backend behavior:

- Require the user to prove address ownership offchain, for example by signing a login message.
- Cache `isSubscribed` only briefly; a balance can expire with time.
- Treat `paidUntilTimestamp` as the next time the customer needs more funds at their current plan.

## Day-To-Day Operations

Local checks:

```bash
npm test
npm run build
```

Deploy with:

```bash
USDC=0x... PROVIDER=0x... RPC_URL=https://... PRIVATE_KEY=0x... npm run deploy
```

After deployment:

- Publish the contract address and ABI to the backend.
- Verify the contract on the chain explorer if the chain supports it.
- Keep the `PROVIDER` key in a multisig or a hardware-backed account.
- Periodically call `settle(account)` for active customers so provider revenue is moved into `providerWithdrawable`.
- Call `withdrawProviderRevenue(recipient, amount)` from the provider address to move earned USDC out.

Anyone can call `settle(account)`, so this can be run by your backend, a keeper, or a simple script. It is not profitable for outsiders by default, so assume your service will usually be the one poking settlement.

## Customer Flows

Top up:

1. Customer approves the billing contract to spend USDC.
2. Customer calls `topUp(amount)`.

Start or change plan:

1. Customer calls `startSubscription(1)` for Hobby or `startSubscription(2)` for Pro.
2. If they already had an active plan, the contract first settles accrued charges at the old rate.

Cancel:

1. Customer calls `cancel()`.
2. The contract settles accrued usage, marks the subscription inactive, and returns the unused USDC balance.

## What To Watch

- **Settlement lag:** Revenue is only withdrawable after settlement transactions. Backend authorization still works from views, but accounting dashboards should understand the difference between accrued and settled revenue.
- **USDC address:** Deploy against the real USDC token for the chosen chain, not a bridged impostor unless that is intentional.
- **30-day months:** Pricing uses a fixed 30-day period, not calendar months.
- **Public metadata:** Customer addresses, balances, plans, top-ups, cancellations, and usage timing are visible onchain.
- **Tiny rounding dust:** Accrual rounds down to whole USDC base units. This is usually negligible with 6-decimal USDC.
- **Provider key risk:** The provider can withdraw earned revenue but cannot take customer credit that has not accrued. Losing this key strands settled revenue until a new contract is deployed.
