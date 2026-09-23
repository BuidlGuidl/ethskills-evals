# Prepaid subscription billing

This repo contains a Foundry-based USDC subscription contract for a small API service.

## Contract model

`PrepaidSubscriptions` keeps a prepaid USDC balance per customer address. A customer:

1. Approves USDC to the contract.
2. Calls `deposit(amount)` or has someone call `depositFor(customer, amount)`.
3. Calls `subscribe(Plan.Hobby)` or `subscribe(Plan.Pro)`.

Plans are priced in USDC smallest units:

- Hobby: `5_000_000`, or 5 USDC per 30-day month.
- Pro: `20_000_000`, or 20 USDC per 30-day month.

Charges accrue over time at the chosen monthly rate. They are settled lazily when a customer deposits, changes plan, cancels, or when anyone calls `settle(customer)` / `settleBatch(customers)`. This keeps request-time checks cheap while still letting the merchant periodically realize earned revenue.

`cancel()` settles usage through the current block, clears the subscription, and refunds the remaining prepaid balance.

## Backend access check

For each incoming API request, recover or look up the customer's wallet address and call:

```solidity
isSubscribed(address customer) returns (bool)
```

For richer logging or plan gating, call:

```solidity
accountStatus(address customer)
```

That returns:

- `active`: whether the address has remaining prepaid credit at the current plan rate.
- `plan`: `None`, `Hobby`, or `Pro`.
- `prepaidBalance`: last stored prepaid balance before view-only accrued charges.
- `accruedCharge`: charge accrued since the last settlement.
- `availableBalance`: prepaid credit remaining after view-only accrued charges.
- `creditUntil`: timestamp when the current prepaid balance runs out if the plan is unchanged.

If you want Hobby and Pro to unlock different API limits, check both `active` and `plan`.

## Deployment

Set the real USDC token address for your target chain. Optionally set `OWNER_ADDRESS`; otherwise the broadcast sender is used as owner.

```sh
export USDC_ADDRESS=0x...
export OWNER_ADDRESS=0x...
forge build
forge test
forge script scripts/DeployPrepaidSubscriptions.s.sol:DeployPrepaidSubscriptions \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

The owner can withdraw earned revenue with:

```solidity
withdrawMerchantRevenue(treasury, amount)
```

## Day-to-day operations

Run a small keeper job, for example hourly or daily, that calls `settleBatch` for active customer addresses. The API check works without this job, but settling keeps `merchantAccrued` current and makes accounting easier.

Keep your backend's customer-address index in sync with signups, deposits, subscriptions, cancellations, and lapsed accounts. The contract emits events for those transitions, so an event indexer is the simplest source of truth.

Withdraw `merchantAccrued` to a treasury wallet on a regular cadence. Use a multisig for the owner and treasury in production.

## Things to watch

- USDC address and decimals: prices assume a 6-decimal USDC-like token.
- Chain choice: deploy where your customers have cheap transactions and real USDC liquidity.
- Rounding: accrued charges round down to the nearest USDC atom, slightly favoring customers.
- Expiry edge: `isSubscribed` becomes false when available credit reaches exactly zero.
- Plan changes: switching plans first settles usage at the old rate, then requires enough remaining prepaid balance for one full month of the new plan.
- Indexing gaps: if your backend caches subscription state, use `creditUntil` as the cache expiry and refresh from chain when it is near or past.
- Key management: keep the owner in a multisig and restrict operational private keys to keeper settlement only.
- Contract upgrades: this implementation is intentionally non-upgradeable. Deploy a new contract and migrate customers if pricing or billing rules need to change.

