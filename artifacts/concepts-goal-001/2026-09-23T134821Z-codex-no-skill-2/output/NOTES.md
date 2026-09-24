# WeatherSubscriptions Notes

This project uses Foundry. The readable source lives in `contracts/`, `script/`, and `test/`.

## Model

Customers prepay USDC into `WeatherSubscriptions`, then choose either:

- `Hobby`: 5 USDC per 30-day billing period
- `Pro`: 20 USDC per 30-day billing period

The contract treats "monthly" as a fixed 30-day period so every chain computes the same answer. Charges accrue continuously at the selected plan rate. Earned funds move into `serviceBalance` when someone calls `settleAccount` or `settleAccounts`; the owner can withdraw only that earned `serviceBalance`.

Unspent customer funds remain escrowed as `prepaid`. A customer can call `cancel()` at any time; the contract settles through the current block, turns off the subscription, and refunds the remaining `prepaid` USDC.

## Useful Commands

```sh
npm run build
npm test

USDC_ADDRESS=0x... OWNER_ADDRESS=0x... \
  forge script script/DeployWeatherSubscriptions.s.sol:DeployWeatherSubscriptions \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --verify
```

`OWNER_ADDRESS` should be the account or multisig that is allowed to withdraw earned service revenue and transfer ownership.

## Backend Checks

For each API request, check the caller's wallet address with:

```solidity
isSubscribed(address customer) returns (bool)
```

For richer logging or customer UI, read:

```solidity
accountOf(address customer)
paidThrough(address customer)
```

`isSubscribed` is a pure read path from your backend's perspective. It does not require the account to be settled first. If an account is out of prepaid funds, it returns `false` even before anyone has called `settleAccount`.

## Customer Flow

1. Customer approves the subscription contract to spend USDC.
2. Customer calls `depositAndSubscribe(amount, plan)` for the simplest first setup.
3. Later top-ups use `deposit(amount)`. If the account still has a selected plan, the top-up extends the account's paid-through time.
4. Plan changes use `subscribe(plan)`. The contract settles the old plan through the current block and applies the new rate from that point forward.
5. Cancellation uses `cancel()`, which refunds unused prepaid USDC.

## Day-to-Day Operations

Run a small job to call `settleAccounts(customers)` over active or recently-lapsed customers. Daily is usually enough for a small API. This is not needed for the backend authorization check, but it moves earned USDC into `serviceBalance` so the owner can withdraw it.

Withdraw revenue with `withdrawServiceBalance(treasury, amount)` from `OWNER_ADDRESS`. The contract should always hold at least:

```text
sum(customer prepaid balances) + serviceBalance
```

The public token balance can be higher if USDC was sent directly to the contract by mistake, but the owner still cannot withdraw more than `serviceBalance`.

## Things To Watch

- USDC address: deploy with the correct USDC token for the chain. The contract assumes 6-decimal USDC pricing.
- Billing definition: this is fixed 30-day billing, not calendar-month billing.
- Owner key: use a multisig for `OWNER_ADDRESS` on mainnet or any chain with real money.
- Indexing: listen for `Deposited`, `Subscribed`, `Settled`, `Canceled`, and `ServiceWithdrawn` to keep your customer admin view current.
- Lapsed accounts: `accountOf` may show escrowed `prepaid` for a lapsed account until it is settled. `isSubscribed` is still the source of truth for API access.
- Gas batching: keep `settleAccounts` batches small enough for the target chain's gas limits.
- Product changes: plan prices are constants in this version. Deploy a new contract if you need different prices, then migrate customers intentionally.
