# WeatherSubscription Notes

This project uses Foundry. The contract is in `src/WeatherSubscription.sol`, tests are in
`test/WeatherSubscription.t.sol`, and deployment is in `script/Deploy.s.sol`.

## Model

Customers deposit USDC into the contract, then choose the hobby or pro plan. The monthly prices are
fixed in the contract:

- Hobby: 5 USDC per 30 days
- Pro: 20 USDC per 30 days

The contract does not wake itself up once a month. Nothing onchain is automatic. Instead, each
account accrues against its prepaid balance at the plan's monthly rate. The backend can call
`isSubscribed(address)` or `accountStatus(address)` as a read-only RPC call on every API request.
Those views include virtual accrual, so access expires as soon as the prepaid balance is used up
even if nobody has sent a settlement transaction yet.

Settlement is separate from access checks. Anyone can call `settle(customer)` or `settleMany(...)`
to move already-earned USDC from a customer's escrow balance into `providerBalance`. The service
operator has the direct incentive to do this, because only settled revenue can be withdrawn.

## Day-To-Day Operations

1. Deploy with the real USDC token for the target chain:

   ```sh
   USDC_ADDRESS=0x... OWNER_ADDRESS=0x... forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast --verify
   ```

2. Publish the deployed contract address to customers and your backend config.

3. Customer flow:

   - Customer approves this contract to spend the USDC amount they want to deposit.
   - Customer calls `topUpAndSubscribe(plan, amount)`, or calls `topUp(amount)` and then
     `subscribe(plan)`.
   - Plan IDs are `1` for hobby and `2` for pro.

4. Backend request check:

   - Recover or otherwise identify the customer's wallet address.
   - Call `isSubscribed(customer)` through your RPC provider.
   - For debugging, call `accountStatus(customer)` to see plan, remaining prepaid balance, pending
     charge, and paid-through timestamp.

5. Revenue collection:

   - Periodically call `settleMany(customers)` for active or recently active accounts.
   - Call `withdraw(treasury, amount)` from the owner account to move settled USDC to your treasury.

6. Cancellation:

   - Customer calls `cancel()`.
   - The contract first settles usage through the cancellation block, then refunds the unused USDC
     balance.

## Things To Watch

- There is no cron in the contract. If you want settled revenue available every day, run a keeper,
  backend job, or script that calls `settleMany`.
- Backend access depends on RPC freshness. Use a reliable RPC provider and decide how your API
  behaves during RPC outages.
- USDC has 6 decimals and this contract assumes plan prices in USDC's smallest unit.
- Billing uses 30-day months, not calendar months.
- All customer addresses, balances, plans, deposits, cancellations, and subscription status are
  publicly visible onchain.
- The owner can withdraw settled provider revenue but cannot change plan prices or take customer
  escrow. If prices need to change, deploy a new contract and migrate customers.
- USDC itself is an external dependency. Token-level freezes, pauses, upgrades, or chain-specific
  USDC behavior can affect deposits, refunds, and withdrawals.
- Keep a list or index of customers offchain from `ToppedUp`, `Subscribed`, `Settled`, and
  `Cancelled` events so settlement jobs know which accounts to scan.

## Local Commands

```sh
forge test
forge build
```
