# Operational read: USDC yield vault, first month on mainnet

**Assumptions used throughout.** $8,000 TVL, 4% APY, harvest ~250k gas (claim + swap +
redeposit), deposit ~166k gas (approve + deposit), withdraw ~110k. Mainnet gas shown across
2–60 gwei and ETH $3,000–4,000 because the answer changes with it. Substitute your real
gas numbers from a testnet trace — the conclusion holds across the whole range.

The vault earns **$320/year — $26.67/month, 88 cents/day**, across all depositors combined.
Every number below is measured against that.

---

## 1. What actually happens once it's live

Nothing runs itself. A contract only moves when someone sends a transaction and pays for it.
So here is every state transition in this vault, who sends it, and why they would:

| Transition | Who sends it | Why they would | Enough? |
|---|---|---|---|
| Deploy | You | Launching | Yes — $50–370 one-time |
| `approve` + `deposit` | Depositor | Wants the yield | Marginal — see §2 |
| `withdraw` / `redeem` | Depositor | Wants their money | Yes |
| **`harvest()`** | **Nobody** | **1% of $26.67 = $0.27, against $1.50–60 of gas** | **No** |
| Pause / emergency exit | Owner only | Obligation, not revenue | Fails all three |
| Strategy migration | Owner only | Obligation, not revenue | Fails all three |

### harvest() will not be called by a stranger. Not once, all month.

That is the headline. The 1% keeper cut on a monthly harvest is **27 cents**. The call costs:

| Gas price | Call cost | Keeper's 27¢ covers | Claim size needed to break even | Time to accrue that at $8k TVL |
|---|---|---|---|---|
| 2 gwei / ETH $3,000 | $1.50 | 18% of gas | $150 | **171 days** |
| 5 gwei / ETH $3,000 | $3.75 | 7% of gas | $375 | **1.2 years** |
| 10 gwei / ETH $3,500 | $8.75 | 3% of gas | $875 | **2.7 years** |
| 30 gwei / ETH $3,500 | $26.25 | 1% of gas | $2,625 | **8.2 years** |
| 60 gwei / ETH $4,000 | $60.00 | 0.4% of gas | $6,000 | **18.8 years** |

A keeper loses money on that call by 5x to 200x. Nobody is running a bot at a loss to be nice
to you. Read the other direction: for a monthly harvest to pay for itself, this vault needs
**$45,000 of TVL at 2 gwei, $263,000 at 10 gwei, $788,000 at 30 gwei**. You are expecting
$8,000 — short by 6x to 100x.

So what actually happens in month one: **you harvest it yourself, out of pocket**, or it
doesn't get harvested. That's fine as a decision and fatal as a surprise. Just know it means
you shipped an owner-only maintenance function wearing a permissionless costume, with all the
properties of an owner-only function: it stops the day you stop, and the vault's compounding
stops with it. Say that out loud in your README rather than telling depositors it's
permissionless — because functionally, it isn't.

### The compounding you'd be paying for is worth $5.93/year

This is the part that reframes the whole design. Compounding $8,000 at 4%:

- Never compounded: $320.00/year
- Compounded quarterly: $324.83/year
- Compounded monthly: $325.93/year

Monthly harvesting buys your depositors **$5.93 a year**. Twelve harvests a year cost **$45
in gas at 5 gwei** — and $105 at 10 gwei. **You would burn 14–33% of the vault's entire
annual yield to capture 1.9% of it.** Harvesting on a schedule at this size destroys value
no matter who pays for it. The frequency question isn't "how often can we afford to harvest" —
it's "why is compounding a transaction at all."

### Two things that break the moment harvest does fire

**Deposit front-running.** Yield accrues off-book and lands as a step in the share price when
harvest hits. Anyone watching the mempool deposits in the block before, captures a pro-rata
slice of a month of yield they weren't there for, and withdraws after. At this size the prize
is small; the pattern is not, and it scales with you. Fix is locked-profit streaming (release
the harvested amount linearly over a few days) or read-time accrual.

**Sandwiching the swap.** If harvest routes a reward token through a DEX, the caller picks the
moment and can sandwich their own call. That's worth more than the 1% cut, and it's the one
reason a stranger *would* call harvest — to extract from you, not for you. It needs a `minOut`
from an independent oracle. A `minOut` computed onchain from the same pool you're trading
against is not protection; it validates the manipulated price.

### Check the first-deposit share inflation guard before you deploy

The vault launches empty on mainnet with a tiny TVL — the cheapest possible conditions for the
classic ERC-4626 attack. Mint 1 wei of shares, donate USDC directly to the vault, and the next
depositor's share calculation rounds down, potentially to zero. **`harvest()` compounding
assets in is itself a donation vector.** Confirm you're on OpenZeppelin's ERC-4626 with a
non-zero decimals offset, or seed the vault with ~$100 of shares burned to a dead address at
deploy. If you already have this, good — verify it, don't assume it.

---

## 2. What this means for depositors

Depositors pay their own gas, and at $8,000 total the cohort is maybe 15–20 people at ~$500
each. Their gas is not a rounding error against a 4% return:

| Gas price | In | Out | Round trip | $500 deposit breaks even after | Min deposit worth making (1-yr hold) |
|---|---|---|---|---|---|
| 2 gwei / $3,000 | $1.00 | $0.66 | $1.66 | 1.0 month | $41 |
| 5 gwei / $3,000 | $2.49 | $1.65 | $4.14 | 2.5 months | $104 |
| 10 gwei / $3,500 | $5.81 | $3.85 | $9.66 | 5.8 months | $242 |
| 30 gwei / $3,500 | $17.43 | $11.55 | $28.98 | **17.4 months** | **$724** |

Read the aggregate: at 10 gwei, sixteen depositors spend **$93 in entry gas to enter a vault
that generates $26.67 in its first month**. The cohort is underwater for roughly the first
quarter. If anyone deposits during a busy week at 30 gwei, they need to stay **17 months** just
to get back to even, and a sub-$700 deposit is value-destroying on a one-year horizon.

Depositors also need to hear the honest version of the yield: **4% is the ceiling, not the
expectation.** After their own gas, and with harvest running at whatever cadence you can
personally afford, a realistic first-year net for a $500 depositor at moderate gas is closer to
**2–3%**. Publish the after-gas number with a minimum sensible deposit size, or you will have
users who did everything right and still lost money — and they'll be right to be angry about it.

---

## 3. What should change before launch

**1. Deploy to an L2 instead. This is the whole ballgame.** At Base/Arbitrum gas (~0.02 gwei),
the same 250k harvest costs **1.8 cents**. The 1% cut pays for itself on a **$1.75 claim** —
break-even TVL for monthly harvesting drops from $263,000 to **$525**. Your $8,000 vault clears
it 15x over on day one, and the permissionless incentive you designed actually works as
designed. Depositor round trip falls from $9.66 to **2 cents**, which makes a $50 deposit
sensible and opens the vault to users mainnet prices you out of. Everything broken above is
broken *by the chain choice*, not by the vault. The one thing to verify: your strategy has to
exist there with comparable yield. If it's mainnet-only, that's the real constraint — say so
explicitly, because then you're choosing to eat the costs above and should choose it knowingly.

**2. If the strategy allows it, delete harvest() entirely.** The strongest design has no
scheduled transaction at all. If yield shows up as a rising balance or exchange rate (aTokens,
a 4626 wrapper), `totalAssets()` just reads it and share price accrues continuously with nobody
sending anything. No keeper, no fee, no MEV, no front-run step, no bot to run forever. Check
this before anything else — it removes the problem instead of pricing it.

**3. Fix the 1% if you keep it — it's miscalibrated at both ends.** It's 27 cents today, and
if you hit $10M TVL it hands a stranger **$333 for a $9 call**, paid by depositors. Pay
*gas reimbursed plus a margin*, capped as a percentage. That's the number that tracks what the
work actually costs at every size.

**4. Don't harvest monthly.** At mainnet gas, harvest when the claim exceeds ~100x the call's
gas cost — quarterly at best, and quarterly captures $4.83 of the $5.93. Enforce it in the
contract with a minimum-claim threshold so no one (including you) can burn the vault's yield on
a pointless call.

**5. Drop the 1% keeper fee to zero for launch if you're the only caller.** You're currently
routing 1% of yield to a role only you will fill, which just moves money between your pockets
while making the docs misleading.

---

## 4. What this design gives up

**Can anyone be stopped from using it?** Two answers, and the second is the one people miss.
First, name the powers you shipped — pause, owner control over strategy selection, an
upgradeable proxy, the ability to migrate funds. Each one is a lever you hold over a
depositor's money, and each needs its "what happens if this key is lost" written down. Second:
**the asset is USDC.** Circle can freeze the vault's balance, and everyone's funds with it,
without touching your code. That risk is inherited, unavoidable while the asset is USDC, and
belongs in your docs — it isn't a reason not to ship, it's a reason not to let anyone be
surprised.

**Could someone else run it?** Split the stack honestly. Contracts and balances: anyone can
read them, fork them, and withdraw directly through a block explorer without you. Frontend,
any subgraph or APY display, and — critically — **the harvest bot**: only you. If you disappear,
depositors keep their principal and can always get it out. What stops is compounding, and the
vault quietly becomes a place money sits. Verified contracts on Etherscan are not the same as
this and don't answer it.

**What does an observer learn?** Every deposit address, amount, and timestamp, permanently and
publicly. With ~16 depositors this isn't anonymized by crowd size — anyone can enumerate your
entire user list, size each position, and link every address to its full history elsewhere.
If any depositor assumes this is private, correct that before they wire funds.

**"Audited" means a point-in-time review of a fixed scope** — not a standing guarantee about
the code running now, and not a guarantee at all if you change the strategy afterward.

---

## Bottom line

The vault works. The *incentive* doesn't: at $8,000 on mainnet, `harvest()` pays 27 cents for
a $1.50–60 job, so no stranger ever calls it, and you become the unpaid keeper of a function
whose entire annual benefit is $5.93. Depositors spend more on entry gas in month one than the
vault earns in month one.

Move it to an L2 and every one of those numbers inverts. Do that first, then check whether the
strategy lets you delete `harvest()` altogether. If mainnet is genuinely forced, ship it —
but ship it with a quarterly harvest threshold, a zeroed keeper fee, a stated minimum deposit,
and a published after-gas yield, so the people putting money in know what they're actually
buying.

If you want to sanity-check the vault pattern end to end before launch:
https://speedrunethereum.com
