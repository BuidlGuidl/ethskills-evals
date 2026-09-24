# Running this thing

Operational notes for the USDC subscription billing behind the weather API.
Written for the person on call, which is you.

---

## 1. Where the money actually is

At any moment every USDC in the contract is in exactly one of three buckets:

| Bucket | On chain | Whose is it |
| --- | --- | --- |
| **Credit** | part of `totalUserFunds` | the customer's — withdrawable any time |
| **Escrow** | the rest of `totalUserFunds` | the current paid period, unresolved |
| **Booked revenue** | `merchantAccrued` | yours — withdrawable now |

Escrow is the interesting one. A customer who is 10 days into a 30-day period
has paid for that period, but two thirds of it is still refundable if they
cancel today. So the contract only lets you withdraw revenue *as it is earned*,
second by second, never up front. That is deliberate: **you can never withdraw
money a customer could still legitimately reclaim.** The cost is that your
withdrawable balance always trails your headline MRR by up to one period.

The single invariant that must never break:

```
usdc.balanceOf(contract) >= totalUserFunds + merchantAccrued
```

`script/Ops.s.sol:Health` asserts this and reverts if it fails. See §6.

## 2. "Monthly" means every 30 days

A period is a flat `30 days`, not a calendar month. Calendar arithmetic on chain
is expensive and full of edge cases, and nothing here needs a billing date that
lands on the 1st. The practical consequence: a subscriber is charged **12.17
times a year, not 12**. Annual revenue per hobby seat is $60.83, not $60.

If a customer ever queries this, that is the answer. If you would rather it be
exactly 12, change `PERIOD` to `365 days / 12` and redeploy — it is a constant,
so it cannot be changed on a live contract.

## 3. Nothing runs on a schedule (almost)

Renewals are not pushed by a keeper. When anyone reads or writes an account, the
contract replays every period boundary that has passed since it was last touched
and charges for them. A subscriber who nobody has looked at for eight months
still reports the correct state on the first read. **There is no cron job whose
failure silently stops billing**, which is the main thing that goes wrong with
Stripe-shaped systems.

The one thing you do run on a schedule is the **revenue sweep**, and it only
moves money you have already earned into a withdrawable bucket:

```bash
# 1. Get your subscriber list from the chain (once, then keep it incrementally).
cast logs --rpc-url base --from-block <deploy-block> \
  'Subscribed(address,uint8,uint128,uint64)' \
  --address $(jq -r .subscriptionBilling deployments/base.json) \
  | grep topics -A1        # or use the backend's event watcher, which already indexes these

# 2. Book the elapsed periods.
forge script script/Ops.s.sol:Settle --rpc-url base --broadcast --ledger \
  --sig "run(address[])" "[0xaaa...,0xbbb...]"

# 3. Take the money.
forge script script/Ops.s.sol:Withdraw --rpc-url base --broadcast --ledger \
  --sig "run(address,uint256)" 0xYourTreasury 0     # 0 = everything booked
```

Do this monthly. Doing it late costs you nothing except the delay — the revenue
is accruing either way, it just is not withdrawable until settled. Settling is
permissionless, so if you ever want it automated, any address can run step 2.

On Base, `settleMany` is a few thousand gas per account. Settling a thousand
subscribers costs cents. Batch in chunks of ~200 to stay well under the block
gas limit.

## 4. The gateway

`backend/` is the piece that runs hot. Three things to know:

**Address binding is not optional.** The contract answers "is address X
subscribed". It cannot answer "is this HTTP request from X" — a
`X-Wallet-Address` header would let anyone bill against someone else's
subscription. So a customer signs a nonce with the key that controls the
subscribed address and gets an API key bound to it (`backend/src/apiKeys.ts`).
Keys are stored hashed. **The example store is an in-memory `Map` — move it to
your real database before launch.** Nothing else in `backend/` is a sketch.

**The cache is a latency optimisation, not a correctness component.** Because
renewals are lazy, a single `statusOf` call is always the current truth; there
is no pending-payment state to reconcile. Defaults: positive answers cached 30s,
negatives 5s, and never past the `expiresAt` the contract reports. A cancel
therefore keeps serving for up to 30 seconds. On a $5/month plan that is worth
far less than an RPC call per request. `gate.watch()` subscribes to
`Subscribed`/`Cancelled`/`Lapsed` logs and invalidates within a block, so in
practice it is faster than the TTL.

**RPC failure degrades toward serving.** If the RPC is unreachable and we hold a
cached positive, we keep serving that customer for up to 10 minutes and log
loudly. If we have nothing cached, the request gets **503, never 402** — an RPC
outage is your problem, not a billing decision. Check that your alerting treats
the `[billing] RPC read failed` log line as urgent; it means you are flying on
cache.

## 5. Common support tickets

| They say | What happened | What you do |
| --- | --- | --- |
| "I paid but I get 402" | deposited but never called `subscribe` | tell them to subscribe; the credit is safe |
| "I got cut off mid-month" | credit ran out at a renewal boundary | `Health` on their address shows `expiresAt`; they top up and re-subscribe |
| "I cancelled, where's my refund?" | `cancel()` moves it to credit, it is not auto-sent | they call `withdrawCredit`, or use `cancelAndWithdraw` next time |
| "I got refunded less than I expected" | pro-rata to the second, minus time used | show them the `Cancelled` event: `refunded` + `forfeited` |
| "I lost my wallet" | nothing you can do | **there is no account recovery.** Say so up front in your docs |

That last row is the real product risk of onchain billing. A customer who loses
their key loses their remaining balance and their subscription, and you cannot
reissue either. Put it in your terms before someone finds out the hard way.

## 6. What to alert on

Ordered by how much it should ruin your evening.

1. **Solvency.** `usdc.balanceOf(contract) < totalUserFunds + merchantAccrued`.
   This should be impossible — it is fuzzed and invariant-tested — but it is the
   one number where being wrong means customer funds are gone. Poll `Health`
   every few minutes. If it ever fires, `setPaused(true)` immediately (that
   blocks deposits and sign-ups but deliberately **cannot** block withdrawals or
   cancellations) and work out what happened before touching anything else.
2. **`[billing] RPC read failed`** in the gateway logs. You are serving on stale
   cache; you have roughly 10 minutes before paying customers start getting 503s.
   Have a second RPC provider configured and ready to swap.
3. **402 rate.** A spike usually means a cohort ran out of credit at the same
   time (they all signed up in the same week). Worth a proactive email; it is the
   onchain equivalent of a failed card.
4. **Booked-but-unswept revenue** (`merchantAccrued`) growing past a threshold.
   Not dangerous, just money sitting in a contract instead of your treasury.
5. **Unclaimed accrual** — `accruedIncluding(subscribers) - merchantAccrued`.
   If this is large you have not settled in a while.
6. **Deposits from addresses that never subscribe.** Usually someone confused by
   the two-step flow. If it is common, that is a UI problem, not a support one.

Also worth a dashboard, not an alert: active subscriber count by plan, credit
runway distribution (how many customers lapse in the next 30 days), and the gap
between escrow and booked revenue.

## 7. Changing prices

`setPlan` affects **new sign-ups and plan changes only**. Existing subscribers
keep the rate they signed up at, forever, until they act.

This is on purpose. Lazy renewal means an account might not be settled for
months; if renewals used the current price, raising it would retroactively
re-price periods the customer had already consumed. Grandfathering removes that
whole class of bug, at the cost of not being able to raise prices unilaterally.

To actually reprice existing customers: announce it, call `setPlan`, and ask
them to `changePlan` (or cancel and re-subscribe). `changePlan` credits back
their unused time, so switching mid-period costs them nothing.

To retire a plan without evicting anyone, set `active=false`. Existing
subscribers keep renewing; nobody new can join.

## 8. Deliberate limitations

Things that are not bugs, so you do not rediscover them at 2am:

- **Not upgradeable.** No proxy, no admin key over logic. Migrating means
  deploying a new contract, pointing the gateway at both, and letting the old one
  drain as customers cancel or lapse. Plan a month.
- **The owner key controls plans, pause, and revenue withdrawal.** It cannot
  touch customer credit or escrow, and it cannot block exits. Still: use a Safe,
  not an EOA. `Ownable2Step` means a fat-fingered transfer to a wrong address
  does not brick you — the new owner must accept.
- **USDC is Circle's contract and Circle can freeze addresses.** If they ever
  blocklisted this contract, deposits and withdrawals would both stop. Nothing
  you can do about it; it is the same trust assumption as holding USDC at all.
- **Rounding favours you.** Pro-rata refunds round down, so you keep up to
  1 base unit (0.000001 USDC) per cancellation. Not worth mentioning to anyone.
- **Someone can fund someone else's account.** Intentional — it lets a team pay
  for a bot's address — but it means a deposit's `payer` and `account` differ.
  Your accounting should key on `account`.
- **Anyone can call `settle`.** It only realises revenue that is already owed, so
  there is nothing to exploit, but do not be alarmed by settles you did not send.
- **`sweep` only takes the surplus** over what is owed, so it cannot be used to
  drain customer funds even by a compromised owner key.

## 9. Before you launch

- [ ] Deploy to Base Sepolia, run `backend/src/demo.ts` against it, cancel a real
      subscription and check the refund lands.
- [ ] Verify the USDC address in `script/Addresses.sol` against Circle's docs.
      The deploy script checks there is *a* contract there; it cannot check it is
      the right one. Bridged USDbC is a different asset — do not use it.
- [ ] Transfer ownership to a Safe and have a second signer accept it.
- [ ] Move `ApiKeyStore` off the in-memory Map.
- [ ] Configure a fallback RPC provider.
- [ ] Get the contract audited if you expect meaningful balances. The tests here
      are thorough — including invariant tests that a one-word mutation fails —
      but tests are not an audit.
- [ ] Decide and publish your position on lost keys (§5).
