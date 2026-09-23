# WeatherBilling — operations notes

Prepaid, onchain billing for the weather API. Customers pay you in USDC, you
never touch Stripe, and your backend gates requests with a single free
contract read.

## The model (read this first)

**Smart contracts cannot run themselves.** There is no cron job, no scheduler,
no background process. So this design has no "monthly charge" transaction at
all — nothing would ever trigger it unless you paid a keeper bot to do it.

Instead, billing is a **slow drain**:

- A customer deposits USDC into a prepaid credit balance (`deposit`).
- They pick a plan (`subscribe`), which drains that balance at
  `monthlyPrice / 30 days` per second. A month of hobby costs exactly $5.
- Charging happens **lazily**: whenever the customer's state is next touched
  (deposit, plan switch, cancel, or anyone calling `settle`), the elapsed
  time is settled first.
- **Expiry is passive.** When the balance runs out, the subscription is over
  — no transaction needed to make it so. `isSubscribed` computes it on the
  fly by comparing remaining credit against accrued charges.
- Cancelling refunds every unused cent, computed per second.

Every state transition and who causes it:

| Transition        | Who pokes it  | Why they'd bother                    |
|-------------------|---------------|--------------------------------------|
| deposit           | the customer  | they want service                    |
| subscribe/switch  | the customer  | they want a (different) plan          |
| cancel + refund   | the customer  | they want their money back            |
| settle            | anyone        | nobody needs to — it's housekeeping   |
| subscription laps | **nobody**    | computed, not executed                |
| claim revenue     | you (owner)   | it's your money                      |

This is why you do **not** need Chainlink Automation, Gelato, or a cron box
watching the contract. If you never run a keeper, billing is still correct to
the second. (If you want `Lapsed` events to appear promptly for dashboards,
*then* a cheap keeper calling `settle` is nice-to-have — the frontend can also
just call the view functions.)

## Layout

- `src/WeatherBilling.sol` — the contract (~21 KB runtime, no proxy, no admin
  backdoors into customer funds)
- `script/Deploy.s.sol` — deployment script (env-var configured)
- `test/WeatherBilling.t.sol` — 14 tests incl. fuzz invariants:
  *refund + revenue always equals deposits* and *a funded month never lapses
  early*
- `foundry.toml`, `lib/` — Foundry config and dependencies (generated; a fresh
  clone restores them with
  `forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts`)

Plans are **immutable**: hobby = $5/month, pro = $20/month, fixed at deploy.
USDC is fixed at deploy too (6 decimals — prices are stored as `5e6`/`20e6`).
A "month" is a fixed 30 days.

## Deploying

Foundry toolchain (`foundryup`). On Base mainnet (cheap fees, native USDC):

```sh
export BASE_RPC_URL=https://mainnet.base.org
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c8ac72B70F2aF04879063  # native USDC on Base — VERIFY on basescan.org first
export OWNER_ADDRESS=0x...   # revenue goes here; use a Safe, not a hot key
export PRIVATE_KEY=0x...     # deploy gas payer; can be different from OWNER

forge build
PRIVATE_KEY=$PRIVATE_KEY OWNER_ADDRESS=$OWNER_ADDRESS USDC_ADDRESS=$USDC_ADDRESS \
  forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast

# verify on Basescan so customers can read the source:
forge verify-contract <DEPLOYED_ADDRESS> src/WeatherBilling.sol \
  --rpc-url $BASE_RPC_URL --verifier basescan --verifier-api-key <ETHERSCAN_KEY> \
  --constructor-args $(cast abi-encode "constructor(address,address,string[],uint256[])" \
  $USDC_ADDRESS $OWNER_ADDRESS '["hobby","pro"]' '[5000000,20000000]')
```

To try it locally first: `anvil` and run the same script against
`http://127.0.0.1:8545`.

## Day to day

**Your backend (per request).** One free read — an `eth_call`, no wallet, no
gas, no signing:

```sh
cast call <BILLING_ADDRESS> "isSubscribed(address)(bool)" 0xCUSTOMER... --rpc-url $BASE_RPC_URL
# and, for "top up soon" responses:
cast call <BILLING_ADDRESS> "secondsRemaining(address)(uint256)" 0xCUSTOMER...
```

In code it's a plain eth_call / viem `contract.read.isSubscribed([addr])`.
Cache the answer for a few seconds if you like — a customer can run out of
credit between two requests no matter what you do, and at hobby-tier stakes
that's an acceptable race. Charging is the contract's job, not the backend's;
your backend never writes onchain.

**Customers (document this on your site).** Two transactions once, then
nothing:
1. Approve the billing contract for a deposit amount (like signing a check for
   exactly that amount — never a blank one), then
2. `depositAndSubscribe(amount, planId)` — plan 1 = hobby, 2 = pro.

They can top up any time (`deposit`), switch plans (`subscribe`), or walk away
(`cancel`) and get every unused cent back in the same transaction. If their
credit runs out, the plan is cleared; topping up again and re-picking the plan
resumes service, and they were never billed for the gap.

**You (owner).** Revenue accrues inside the contract as `totalRevenue`.
`claimRevenue()` sweeps it to the owner address — do it weekly or whenever,
it's one transaction. Your only other jobs are watching (below) and keeping
the API itself up.

## What to keep an eye on

**Your owner key — small blast radius, but still use a Safe.** The owner can
do exactly one thing: `claimRevenue()`. It cannot touch customer credit
(refunds go straight to the customer), cannot change prices (immutable),
cannot pause, block, or upgrade anything. If the key leaks, the worst case is
losing unclaimed revenue. Even so, put a 1-of-1 Safe as the owner and keep
the signing key off the server.

**Everything is public.** Balances, who subscribes to which plan, your
revenue — all readable by anyone on Basescan. Fine for a hobby weather API,
but don't advertise it as private. If you ever need privacy, that's a redesign
(pools/mixers/stealth addresses), not a config flag.

**The USDC address at deploy time.** You fix the token once, in the
constructor. A typo there (or a fake "USDC") is unrecoverable without
redeploying. Verify the address on basescan and check 6 decimals before
broadcasting. On Base, prefer the native USDC (0x8335...) over bridged
variants.

**Block timestamps can wiggle a few seconds.** Validators can nudge
`block.timestamp` within a block or two. At $5/month that's sub-cent noise in
both directions — ignore it unless you someday bill very large amounts per
second.

**Reorgs.** Base is optimistic-rollup-finalized; near the head, `isSubscribed`
answers can in principle flip during a reorg. At these stakes don't engineer
for it; if you ever gate something expensive per-request, wait a few
confirmations before honoring a fresh deposit.

**Rounding dust.** Settlements floor to whole micro-dollars; at exhaustion the
contract keeps at most one second's worth (< $0.000003). Nobody will notice.

**Changing prices or plans.** Deploy a new contract. Customers migrate
themselves: `cancel` on the old one (full refund of unused credit, which is
the whole point of prepaying), then deposit against the new one. Point your
backend's `BILLING_ADDRESS` at the new contract and the old one quietly
finishes settling remaining subscriptions. Nothing is stranded — if you
disappear entirely, customers can still cancel and self-refund forever; only
unclaimed revenue would sit there. This contract runs fine without you.

**What you're watching for, concretely:**
- `totalRevenue()` growth vs. what the API's logs say about active users
  (they should roughly agree; if not, someone is bypassing the gate — check
  your middleware, not the contract)
- `Lapsed` events — your churn signal; a wave of them after a deploy or price
  change means something confused people
- long-running subscribers' `secondsRemaining` if you send top-up reminders
  (do it offchain from events; no contract change needed)
- your own unclaimed revenue sitting in the contract for months (claim it)

## Invariants worth keeping tested

If you ever modify the contract, keep these true (they're in the test suite):

1. Money conservation: for any deposit/elapsed-time/cancel sequence,
   refund + revenue == deposit. Nothing created, nothing destroyed.
2. A customer with a full month's credit stays subscribed for that month and
   lapses no later than one second past it.
3. Time between lapse and re-subscribe is never billed.
4. Only the owner can claim revenue, and only from the revenue pool.