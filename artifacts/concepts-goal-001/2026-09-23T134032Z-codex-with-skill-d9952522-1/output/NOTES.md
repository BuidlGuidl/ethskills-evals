# Weather Subscription Billing

This repo contains a small Foundry project for prepaid USDC subscriptions:

- `src/WeatherSubscriptionBilling.sol` holds customer balances, plan state, cancellation, settlement, and revenue withdrawal.
- `script/DeployWeatherSubscriptionBilling.s.sol` deploys the contract from `USDC_ADDRESS` and `TREASURY_ADDRESS`.
- `test/WeatherSubscriptionBilling.t.sol` covers the core subscription, cancellation, renewal, and revenue flows.

## Plans

Amounts assume a 6-decimal USDC token.

- Hobby: `5_000_000` USDC units per 30-day billing period.
- Pro: `20_000_000` USDC units per 30-day billing period.

The contract uses 30-day periods because contracts cannot know calendar months without an oracle or offchain convention.

## Deploying

Set the token and treasury addresses, then broadcast with Foundry:

```sh
export USDC_ADDRESS=0x...
export TREASURY_ADDRESS=0x...
forge script script/DeployWeatherSubscriptionBilling.s.sol:DeployWeatherSubscriptionBilling \
  --rpc-url "$RPC_URL" \
  --broadcast
```

`TREASURY_ADDRESS` receives earned revenue when the owner calls `withdrawRevenue`.
Add `--verify` when you also have the target chain's block explorer credentials configured.

## Customer Flow

1. Customer approves the billing contract to spend USDC.
2. Customer calls `topUp(amount)` or `topUpAndSubscribe(plan, amount)`.
3. Customer calls `subscribe(Plan.Hobby)` or `subscribe(Plan.Pro)` if they did not use the combined helper.
4. Customer can call `cancel()` at any time. Cancellation settles earned value through the current block and returns unspent credit plus the unused part of the current billing period.
5. Customer can call `withdrawCredit(amount)` to pull back extra credit that is not already committed to the current paid period.

## Backend Check

For each API request, call:

```solidity
isSubscribed(customerAddress)
```

or, if you want richer data:

```solidity
subscriptionStatus(customerAddress)
```

`subscriptionStatus` returns whether the address is currently subscribed, which plan it is on, how much would be refundable if it canceled at the current block, remaining uncommitted credit, and the current active-until timestamp.

The view functions simulate monthly renewal from prepaid credit. That means a customer can stay active without anyone sending a renewal transaction exactly at the 30-day boundary.

## Settlement and Revenue

Nothing onchain runs by itself. The contract accrues earned revenue when someone sends a transaction such as `settle(customer)`, `cancel()`, `subscribe(...)`, or `withdrawCredit(...)`.

Anyone can call `settle(customer)`. Your backend should call it periodically, especially for active customers whose `activeUntil` has moved forward in `subscriptionStatus`, because this turns simulated billing into stored accounting and makes revenue withdrawable.

The owner can only withdraw `withdrawableRevenue`, which is value already earned by elapsed service time. Unearned current-period value and customer credit stay in the contract for refunds.

## Operational Watchpoints

- Keep enough RPC capacity for per-request `eth_call` checks, or cache short-lived positive checks if your abuse model allows it.
- Reconcile contract USDC balance against customer credit, unearned balances, and `withdrawableRevenue`.
- Run a lightweight settlement job over active customers so accounting does not lag far behind usage.
- Watch failed USDC transfers or allowance failures in your frontend and support flow.
- The owner can change the treasury and withdraw earned revenue, but cannot pause users, blacklist users, upgrade the code, or withdraw customer credit.
- If the owner key is lost, earned revenue cannot be withdrawn and the treasury cannot be changed, but customers can still top up, subscribe, cancel, and withdraw refundable value.

## Onchain Tradeoffs

- Censorship: there is no pause, blacklist, or upgrade key in this implementation. Users still depend on the chain and USDC contract accepting their transactions.
- Open source and continuity: the subscription state and contract code can be read and forked by anyone. Your weather API, API-key mapping, request logs, and backend enforcement remain offchain and stop working if you stop running them.
- Privacy: observers can see customer addresses, deposits, selected plans, cancellations, settlement activity, and revenue withdrawals forever.
- Security: tests are included, but this is not an audit. An audit would only cover a specific deployed bytecode version and review scope.
