# NOTES — running the onchain billing

## The one design decision that matters

**There is no monthly charge. There can't be.** Smart contracts can't execute
themselves — no cron, no timers, nothing wakes the contract up. Every state
change needs someone to call a function and pay gas. A "charge every subscriber
on the 1st of the month" function would need you (or a bot) to poke every
single account, paying gas each time, forever.

So the contract doesn't charge monthly. Instead:

- A deposit **burns down per second** at the plan's rate ($5 or $20 per 30 days).
- Settlement is **lazy**: whenever an account is touched (top-up, plan change,
  cancel, or an explicit `settle()`), the contract charges for the elapsed time
  right then and moves it into `accruedFees`.
- The view functions your backend reads (`isSubscribed`, `remainingBalance`)
  **project the burn-down on read**, so the answers are always correct even if
  nobody ever calls `settle()`. There is no stale state to clean up.

For every state transition, ask "who pokes it and why?" — here the answer is:
- **Customers** poke it (subscribe / topUp / cancel) because they want service
  or their money back.
- **You** poke it (`settle` + `withdrawFees`) because that's your revenue.
- Nothing else needs to happen, ever. A subscriber who goes quiet and lets
  their balance hit zero simply stops passing `isSubscribed` — automatically,
  on the next read, with no transaction at all.

## Day to day

### Deploying

```bash
cp .env.example .env   # fill in RPC_URL, USDC_ADDRESS, PRIVATE_KEY
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

Deploy to an L2 (Base, Arbitrum, OP — real USDC addresses are in the deploy
script comments). Subscribing costs a transaction, and asking customers to pay
$3 of mainnet gas to deposit $5 will kill you. On an L2 the whole customer
flow costs cents.

The deployer key becomes the **owner** — the only thing the owner can do is
withdraw accrued fees. Use a dedicated key, not your treasury.

### Customer flow

1. Customer approves the contract to spend their USDC (the standard ERC-20
   approve — like signing a check for a specific amount, not a blank one).
2. Customer calls `subscribe(Hobby, amount)` or `subscribe(Pro, amount)`.
   They can prepay as many months as they like.
3. `topUp(amount)` adds funds anytime; `changePlan(...)` switches tiers
   (settles at the old rate first); `cancel()` refunds everything unspent.
4. If the balance runs out, the subscription lapses. If they later `topUp`,
   the clock restarts from that moment — **nobody ever owes back-debt** for
   the lapsed gap. Deliberate choice: dunning people onchain is how you get
   angry users and no extra revenue.

### Checking a subscriber from your backend (per request)

This is a free `eth_call` — no transaction, no gas:

```bash
cast call $BILLING_ADDRESS "isSubscribed(address)(bool)" $USER_ADDRESS --rpc-url $RPC_URL
```

```ts
// viem
const ok = await client.readContract({
  address: BILLING_ADDRESS,
  abi: billingAbi,
  functionName: "isSubscribed",
  args: [userAddress],
});
```

Also useful: `remainingBalance(address)` and `secondsUntilLapse(address)` —
e.g. to email customers when they're about to lapse. Cache the result for a
few seconds per address if your request volume is high; the answer can only
go from true→false, never false→true, between transactions.

### Collecting revenue

Whenever you feel like it (weekly, monthly — it's all the same to the
contract):

```bash
# Settle some accounts (optional — anyone can call this; it just moves
# what's already owed into accruedFees). Batch by casting a few addresses.
cast send $BILLING_ADDRESS "settle(address)" $USER --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Withdraw accrued fees to wherever you want
cast send $BILLING_ADDRESS "withdrawFees(address)" $TREASURY --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

`settle` on an account is optional housekeeping: the money is owed whether or
not you poke it, and `cancel()`/`topUp()` settle as a side effect anyway.

## What to keep an eye on

**Your owner key.** Compromise blast radius is limited by design — the owner
can only withdraw `accruedFees`, never user principal, and users can always
cancel and pull their own money out regardless. But accrued-but-unwithdrawn
fees are stealable, so withdraw regularly and keep the key somewhere boring
and safe.

**This is a service, not a hyperstructure.** It runs forever without you in
the sense that subscribers never depend on you to keep their state correct —
but the plans, prices, and fee withdrawal are yours, and your API backend is
obviously still yours. That's fine; just don't describe it to users as
"decentralized."

**You can't freeze anyone, and neither can a bug in this contract — but USDC
itself can.** Circle can freeze addresses at the token level. Your users are
trusting Circle exactly as much as they were trusting Stripe. Worth a line in
your docs; not worth losing sleep over for $5 plans.

**Everything is public.** Every subscriber's address, plan, deposit size, and
top-up timing is visible on a block explorer. If a customer cares about
privacy, tell them to use a fresh address for this service.

**Prices are immutable.** `$5/$20 per 30 days` is baked into the contract —
changing prices on existing subscribers onchain would be rewriting their deal,
so the contract simply doesn't allow it. To change prices you deploy a new
contract and migrate (old subscribers cancel with a full refund of the
unspent balance and re-subscribe on the new one). Note "month" = 30 days
exactly, not calendar months.

**Rounding dust favors the customer.** Per-second accrual truncates toward
the subscriber by fractions of a cent. This is intentional and costs you
nothing measurable.

**No audit.** These are ~200 lines of uncomplicated Solidity with tests
covering the money paths (accrual, lapse, refund, fee withdrawal), but an
audit is a point-in-time review by professionals, not something the test
suite replaces. If the total deposits ever grow past "hobby money," get one.

**RPC dependence.** Your per-request `isSubscribed` check goes through your
RPC provider. If it goes down, fail closed for writes and consider a short
grace cache for reads — and remember anyone can verify the same state with
any node, so your backend is replaceable, which is the point.

## Layout

```
src/SubscriptionBilling.sol   the contract
test/SubscriptionBilling.t.sol  tests (forge test)
test/mocks/MockUSDC.sol       6-decimal USDC stand-in for tests
script/Deploy.s.sol           deployment (forge script ... --broadcast)
.env.example                  config template
```
