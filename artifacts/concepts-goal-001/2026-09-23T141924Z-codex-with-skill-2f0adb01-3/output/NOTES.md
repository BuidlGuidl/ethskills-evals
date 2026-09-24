# Weather Subscriptions

This project implements prepaid USDC billing for a small API service. Customers deposit USDC, choose either the `hobby` or `pro` plan, and the contract accrues fees at that plan's monthly rate until the prepaid balance runs out or the customer cancels.

The key onchain constraint is that contracts do not run by themselves. There is no native monthly timer, so the contract prices plans monthly but accrues them continuously. The backend can always call `isSubscribed(address)` or `subscriptionStatus(address)` as a view, without needing a transaction to make the answer current.

## Contract

- `contracts/WeatherSubscriptions.sol`
  - USDC escrow for customer balances.
  - `hobby`: 5 USDC per 30 days.
  - `pro`: 20 USDC per 30 days.
  - Customers call `topUp(amount)` after approving USDC.
  - Customers call `subscribe(Plan.Hobby)` or `subscribe(Plan.Pro)`.
  - Customers call `cancel()` to stop and receive their unused balance.
  - Anyone can call `settle(account)` to move accrued fees from a customer's escrow balance into `withdrawable`.
  - The owner can call `withdraw()` or `withdrawAll()` to send earned USDC to the treasury.

`isSubscribed(account)` is the backend-facing check. It returns `true` when the address has an active plan and enough remaining prepaid balance to cover elapsed usage.

## Deploy

Set environment variables for the real USDC token and your revenue wallet:

```sh
export USDC_ADDRESS=0x...
export TREASURY_ADDRESS=0x...
```

Then deploy with Foundry:

```sh
forge script script/DeployWeatherSubscriptions.s.sol:DeployWeatherSubscriptions \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Add `--verify` plus your explorer settings if you want source verification during deployment.

## Backend Use

For each API request:

1. Recover or look up the customer's wallet address.
2. Call `isSubscribed(address)` against the deployed contract.
3. If it is `true`, serve the request.
4. If it is `false`, return a billing/top-up response.

For account pages, call `subscriptionStatus(address)` to show the plan, remaining USDC balance, total paid, and `activeThrough` timestamp.

## Day-to-Day Operation

Fees accrue in the view math immediately, but earned funds only become withdrawable after `settle(account)` is called. Your backend can opportunistically call `settle(account)` for the requesting customer when enough time has passed to make the gas worthwhile. A separate keeper is also fine, but the system does not depend on it for access checks.

Withdraw earned funds periodically with `withdrawAll()`. User escrow that has not been earned cannot be withdrawn by the owner.

## What To Watch

- **USDC address:** deploy with the canonical USDC address for the chain you use. A mock token is only for tests.
- **Decimals:** prices are fixed for 6-decimal USDC.
- **Plan length:** one billing month is exactly `30 days`, not a calendar month.
- **Backend identity:** the contract checks addresses. Your API still needs a reliable way to bind requests to wallet addresses, usually a signed login challenge.
- **Privacy:** subscription plan, top-ups, cancellations, and balances are publicly visible onchain.
- **Gas economics:** settling tiny amounts can cost more gas than the fee being collected. Batch or opportunistically settle accounts with meaningful accrued balances.
- **Treasury key:** the owner can change the treasury and withdraw earned fees. Keep that key in a multisig for production.
- **No admin pause:** there is deliberately no global pause switch. That keeps customers able to cancel and recover unused funds even if your service has an operational issue.
