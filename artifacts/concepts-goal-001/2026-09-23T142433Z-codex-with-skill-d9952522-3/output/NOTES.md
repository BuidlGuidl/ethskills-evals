# WeatherSubscriptions Notes

## What Was Built

`WeatherSubscriptions` is a non-upgradeable prepaid USDC subscription contract for the weather API.

- Customers call `topUp(amount)` after approving USDC.
- Customers call `selectPlan(Plan.Hobby)` for `$5 / 30 days` or `selectPlan(Plan.Pro)` for `$20 / 30 days`.
- The backend checks `isSubscribed(customer)` with a normal `eth_call` before serving an API request.
- Customers call `cancel()` to stop the plan and receive all unused credit.
- The owner calls `withdrawRevenue(amount)` to move settled, earned USDC to the configured treasury.

Prices assume a 6-decimal USDC token. One "month" is fixed at `30 days`, which keeps the math deterministic onchain.

## Day-To-Day Operation

There is no onchain cron. Contracts do not wake up by themselves, so subscription validity is computed from the customer's stored balance, plan price, and `settledAt` timestamp.

Your backend should:

- Require customers to sign in with the address they use onchain.
- Call `isSubscribed(address)` before serving each request, or cache the result only briefly.
- Optionally call `accountOf(address)` when showing plan, remaining credit, or paid-through time in your own dashboard.
- Treat `false` from `isSubscribed` as "do not serve paid API data."

Revenue collection is lazy:

- `settle(customer)` converts elapsed prepaid credit into `withdrawableRevenue`.
- `settleMany(customers)` does the same for a batch.
- Anyone can settle accounts, but in practice you will run this from your backend, indexer, or an ops script over addresses seen in `ToppedUp` / `PlanSelected` events.
- If nobody settles, `isSubscribed` still works. The main thing delayed is your ability to withdraw earned revenue.

Deployment:

```sh
cp .env.example .env
# Fill USDC_ADDRESS, TREASURY_ADDRESS, RPC_URL, and PRIVATE_KEY.
npm run build
npm test
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
```

## What To Watch

- USDC address: deploy with the real USDC contract for the chain you use. A wrong token address strands the product on the wrong asset.
- Treasury key: the owner can change `treasury`, withdraw settled revenue, transfer ownership, and recover only excess USDC not reserved for customers or revenue. The owner cannot withdraw active customer balances through `withdrawRevenue`.
- Expired accounts: once a customer runs out of prepaid credit, `isSubscribed` returns false even before a settlement transaction is mined.
- Rounding: accrual is second-based at the monthly price. Very tiny dust amounts can round in the customer's favor.
- Direct token transfers: if someone sends USDC straight to the contract instead of using `topUp`, it is not credited to them. It is recoverable only as excess.
- Backend identity: onchain subscription status only says an address is paid up. Your API still needs to verify that the caller controls that address, usually with a signed message/session.
- Privacy: observers can see customer addresses, deposits, plan selections, cancellations, and revenue events forever. Do not put customer secrets or API keys onchain.
- Liveness: customers can top up, switch plans, cancel, and recover unused credit without your backend. The weather API itself still depends on you running it.
- Censorship and operator powers: the contract has no pause, blacklist, upgrade hook, or owner control over whether a paying customer is subscribed. If the owner key is lost, users can still cancel and get unused credit, but settled revenue cannot be withdrawn and the treasury cannot be changed.

