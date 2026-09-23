# Weather API Onchain Billing Notes

## What Was Built

This repository uses Foundry and contains one production contract:

- `src/WeatherApiBilling.sol` - prepaid USDC subscriptions for a weather API.
- `script/DeployWeatherBilling.s.sol` - deployment script expecting `USDC_ADDRESS` and `BILLING_OWNER`.
- `test/WeatherApiBilling.t.sol` - focused behavior tests with a mock USDC token.

The contract has two fixed plans priced in 6-decimal USDC:

- Hobby: `5_000_000` USDC units per 30-day billing month.
- Pro: `20_000_000` USDC units per 30-day billing month.

Customers approve USDC, top up the contract, and subscribe to a plan. The contract converts their prepaid USDC value into a `paidThrough` timestamp. Your backend can check access with:

```solidity
isSubscribed(address customer) returns (bool)
```

or inspect richer state with:

```solidity
subscriptionOf(address customer)
```

## Day-To-Day Operation

Nothing onchain runs by itself. There is no monthly cron job hidden inside the contract. A customer is considered subscribed while their selected plan is not `None` and their `paidThrough` timestamp is still in the future.

Revenue accrues as time passes, but it is moved into `providerBalance` only when someone sends a transaction that settles an account:

- `topUp`, `subscribe`, and `cancel` settle the caller's account as part of their normal flow.
- `collect(customer)` settles one customer without changing their subscription.
- `collectMany(customers)` batches settlement for operational sweeps.

The provider has the clearest incentive to call `collect` or `collectMany`, because settled revenue becomes withdrawable. Users also settle naturally when they cancel, change plans, or add more funds. If nobody calls settlement for an expired subscription, access still turns off because `isSubscribed` reads the timestamp directly; only provider revenue withdrawal waits for a later transaction.

## Typical Customer Flow

1. Customer approves the billing contract to spend USDC.
2. Customer calls `topUp(amount)`.
3. Customer calls `subscribe(Plan.Hobby)` or `subscribe(Plan.Pro)`.
4. Your API receives requests signed by, authenticated as, or otherwise mapped to the customer address.
5. Your backend performs an `eth_call` to `isSubscribed(customer)`.
6. If the customer cancels, `cancel()` settles earned service time and transfers unused value back to them.

`topUpFor(account, amount)` also exists if another wallet or an app flow pays on behalf of a customer.

## Deployment

Install/use Foundry, then run:

```bash
forge build
forge test
USDC_ADDRESS=0x... BILLING_OWNER=0x... forge script script/DeployWeatherBilling.s.sol:DeployWeatherBilling --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

Use the canonical USDC contract address for the chain where your API will check subscription state. `BILLING_OWNER` receives the right to withdraw settled provider revenue and transfer ownership. There is no pause switch, blacklist, upgrade proxy, or owner function that can move customer refundable balances.

## Backend Checks

Use `eth_call`, not a transaction, for request-time checks. Cache results carefully:

- Cache only for a short period, because top-ups and cancellations change access immediately.
- Treat `paidThrough` as the source of truth if you use `subscriptionOf`.
- Pin checks to the same chain where customers pay.
- Decide how your API maps a request to an address, such as SIWE login, API keys issued after wallet auth, or request signatures.

The contract does not authenticate API requests. It only answers whether an address is paid up.

## What To Watch

- USDC decimals: prices assume 6 decimals. Do not deploy this unchanged with an 18-decimal token.
- Settlement batching: run regular `collectMany` jobs for active or recently expired subscribers so provider revenue is available to withdraw.
- RPC reliability: if your backend cannot read the chain, choose whether to fail closed, fail open briefly, or use a fallback RPC.
- Chain choice: fees matter. Subscription top-ups, cancels, and provider sweeps are user or operator transactions, so a low-fee L2 is usually a better fit than mainnet.
- Indexing: keep an offchain list of customers from `Subscribed`, `ToppedUp`, and `Cancelled` events so your sweep job knows which addresses to collect.
- Rounding dust: USDC has micro-dollar precision. Tiny sub-micro accrual remainders can be lost when a customer cancels or changes plans, and tiny deposits may remain as unallocated credit until enough is added to buy service time.
- Direct token transfers: if someone transfers USDC directly to the contract instead of calling `topUp`, the contract cannot know which account to credit.

## What This Gives Up

Can anyone be stopped from using it? The contract has no pause, blacklist, or upgrade path. The owner can withdraw only settled provider revenue and transfer ownership. If the owner key is lost, users can still top up, subscribe, cancel, and receive refunds; the provider just loses the ability to withdraw settled revenue.

Could someone else run it? The contracts and onchain subscription state can be read and forked by anyone. Your weather API, customer authentication, RPC choices, indexer, and billing sweep job are still offchain services you run. If your company disappears, users can still cancel and recover unused USDC from the contract, but the weather API itself stops unless someone else operates a compatible service.

What does an observer learn? Addresses, top-up amounts, plan choices, paid-through timestamps, cancellations, settlement timing, and provider withdrawals are public forever. Your API keys or endpoint logs may be private in your backend, but the payment relationship is visible onchain.

What does "audited" cover? An audit would cover a particular commit and scope at a point in time. It would not guarantee future deployments, backend logic, key management, RPC behavior, or changes made after the reviewed version.
