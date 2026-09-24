# Operational read: USDC vault, first month on mainnet

## The short version

At $8,000 of deposits on Ethereum mainnet, `harvest()` never gets called by a
stranger. Not rarely — never. The 1% bounty is worth about **27 cents a month**
and the call costs **$5–$16 of gas**. No one is going to pay $10 to earn $0.27,
so the state transition your whole yield story depends on simply does not
happen. You will end up calling it yourself, out of your own pocket, and the
gas you spend doing it is a large fraction of the yield the vault produces.

Nothing about this is a bug in the code. It is an incentive that doesn't clear
at your size. Below is the arithmetic, then what it means for depositors, then
what I'd change.

## Assumptions I'm using

Stated so you can re-run this with your own numbers:

- TVL $8,000, flat across month one
- 4% APY gross on held USDC
- `harvest()` costs ~350,000 gas (claim + swap reward token → USDC + redeposit).
  A simple claim-and-deposit could be 250k; anything touching a DEX router is
  usually 300–450k.
- ETH at $3,000; mainnet base fee 5 gwei (quiet) / 15 gwei (normal) / 40 gwei
  (busy). Check live numbers before launch — the conclusion doesn't move, but
  the magnitudes do.

That puts one `harvest()` at **$5.25 quiet / $15.75 normal / $42 busy**.

## What the vault actually earns

| Period | Gross yield on $8,000 | 1% harvest bounty |
|---|---|---|
| Day | $0.88 | $0.009 |
| Week | $6.15 | $0.06 |
| Month | $26.67 | **$0.27** |
| Year | $320.00 | $3.20 |

The bounty for a full month of accrued rewards is 27 cents against a $5–16 gas
bill. A caller is down 20–60× on the trade. There is no gas price on mainnet at
which this is worth a stranger's transaction.

### How big would the vault have to be?

Set the 1% bounty equal to the gas cost and solve for TVL:

| Harvest cadence | Break-even TVL @ $5.25 gas | @ $15.75 gas |
|---|---|---|
| Monthly | ~$158,000 | ~$473,000 |
| Weekly | ~$685,000 | ~$2.05M |
| Daily | ~$4.8M | ~$14.4M |

And break-even means the caller nets exactly zero. To attract someone
*reliably*, in competition with every other bounty onchain, assume you need
2–3× that. So the design as written starts working somewhere around **$500k of
TVL for monthly harvests** — roughly 60× where you're starting. It is a fine
design for the vault you might have in two years. It is not the design for the
vault you're launching next week.

## So what actually happens in month one

1. You deploy. Deposits trickle in.
2. Rewards accrue in the strategy. Nobody calls `harvest()`.
3. Somewhere around week two you notice the share price hasn't moved and you
   call `harvest()` yourself from the deploy wallet. You pay ~$10 of gas and
   pay yourself a $0.13 bounty. Net: **−$9.87**.
4. You do this on some ad-hoc cadence for the rest of the month because there's
   no scheduler onchain and no external party with a reason to act.
5. If you stop — you're travelling, the key is on a laptop that died, you got
   bored — the vault quietly stops compounding and nobody else picks it up.

Step 5 is the real finding. A vault whose only maintenance path is "the founder
remembers" is an operator-run product wearing permissionless clothing. Worth
being clear-eyed about that before it appears in any marketing copy.

### What your own gas costs, annualised

Against $320/year of gross yield:

| Your cadence | Gas/year @ $10 | Share of gross yield |
|---|---|---|
| Daily | $3,650 | 1,140% — burns 11× the yield |
| Weekly | $520 | 163% — still negative |
| Monthly | $120 | 38% |
| Quarterly | $40 | 13% |

### The compounding you're buying with that gas is worth ~$6/year

$8,000 at 4%: simple = $320.00, monthly compounded = $325.93, daily compounded
= $326.49. Moving from monthly to daily harvesting buys you **56 cents a year**
of extra compounding and costs **$3,530 a year** in additional gas.

This is the point I'd most want to land: at this size, harvest frequency is
almost irrelevant to returns and enormously relevant to costs. Harvest as
*rarely* as the strategy permits, not as often as you can.

## What this means for your depositors

**Their gas dwarfs their yield.** Approve + deposit is ~200k gas ($3–9);
withdraw is ~150k ($2–7). Call it **$6–16 for a round trip**. If you have 20
depositors at $400 each:

- $400 earns **$16/year**, i.e. $1.33/month
- A $12 round trip is **9 months of yield** just to get in and out
- Below ~$300 a depositor is structurally underwater; at $100 the break-even
  hold is about three years

Anyone depositing under roughly $1,000 is paying you a fee to lose money
slowly. If they withdraw in a hurry during a gas spike, the exit alone can cost
more than everything they earned.

**Early exits may earn literally zero.** If share price only moves when
`harvest()` lands, then rewards accrued since the last harvest aren't in the
share price. A depositor who enters and exits between two harvests gets back
exactly what they put in, minus gas, and leaves their accrued rewards to
whoever is still in the vault. On a quarterly harvest cadence that's anyone
holding less than three months — which at launch is most people. Confirm
whether your accounting does this. If it does, either accrue at read time from
a timestamp so the share price is always current, or say plainly in the docs
that rewards are only realised at harvest.

**The honest number isn't 4%.** After your gas, monthly harvesting nets the
vault ~2.5% APY, and after a depositor's own entry/exit gas a $400 ticket sees
something close to zero in year one. Publish that, with the assumed gas price,
rather than "4% APY."

## What I'd change before launch

**1. Launch on an L2 instead.** This is by far the highest-leverage change and
it fixes every problem above at once. On Base or Arbitrum a harvest costs cents
rather than dollars. The 1% bounty starts clearing for real strangers in the
low tens of thousands of TVL instead of the high hundreds of thousands, so the
permissionless design you designed actually functions. Depositor entry cost
drops from 4% of a small ticket to a rounding error, which means you can serve
the $100–500 depositors who are presumably your first users. The mainnet
version of this product needs ~$500k of TVL before it makes sense; the L2
version makes sense on day one. If there is a reason the strategy must be on
mainnet, that reason is worth stating explicitly — it's the single most
expensive constraint in the design.

**2. If you stay on mainnet, plan to be the keeper and budget for it.** Not a
fallback — the plan. Roughly $120/year of gas for monthly harvests. Fund a
dedicated keeper wallet, don't run it from the deployer, and write down who
holds that key and what happens when they're unavailable.

**3. Add a minimum-claim threshold to `harvest()`.** Make it revert unless the
claimable amount exceeds some multiple of current gas cost — say 5–10×. This
stops you or anyone else from burning $10 to compound $2, and it makes the
"don't harvest often" policy a property of the contract instead of a habit. Set
it in USDC terms and make it adjustable.

**4. Keep the 1% bounty, but stop treating it as the mechanism.** It costs
nothing to leave in and it starts working on its own once TVL grows, which is
exactly what you want. Just don't ship on the assumption it's load-bearing on
day one. Consider `max(1% of claim, small flat floor)` so it converges toward
covering real gas rather than scaling off a percentage — a percentage bounty
against a fixed-dollar cost only balances at one TVL.

**5. Make sure withdrawals never depend on a harvest.** Whatever else breaks,
a depositor must be able to exit without anyone having called `harvest()`
first. If the withdraw path touches the strategy's reward logic, decouple it.

**6. Check the first-depositor share inflation attack.** A donation attack on
an ERC-4626-style vault is cheapest exactly when the vault is near-empty, which
is where you'll be for the first few days. Seed the vault yourself with a
locked initial deposit, or use virtual shares/offset. This is a code-safety
question rather than an operational one, so run it through a proper security
review — flagging it here because launch week is precisely the window.

**7. Rewrite the launch copy.** Right now the natural pitch is "permissionless,
self-sustaining, 4% APY." At $8k on mainnet, all three words are doing work the
system can't back up. "We harvest monthly; anyone can too once it's worth their
gas; net yield after costs is ~2.5% and entry costs about $10" is less exciting
and is the thing that's true.

## What this design gives up

Worth writing down now, because these belong in your README and someone will
ask:

**Can anyone be stopped from using it?** Depends on what you shipped — if
there's a `Pausable`, an `onlyOwner` over user funds, or an upgradeable proxy,
name each one and say what it lets you do to a depositor's money and what
happens to depositors if that key is lost. If you shipped none of them, say
that; it's the stronger answer. Either way, don't leave scaffolded owner powers
in the contract unmentioned.

**Could someone else run it?** The contracts, yes — they're onchain and anyone
can read and call them. But in practice the vault's compounding depends on your
keyboard, and your frontend and any offchain accounting are yours alone. If you
disappear, depositors can still withdraw directly against the contract (assuming
change 5 above), and the vault stops earning. Say that split out loud.

**What does an observer learn?** Everything. Every deposit address, every
amount, every entry and exit time, permanently and publicly. With 20 depositors
there's no crowd to hide in — anyone can watch a specific person's position
move. Depositors who assume otherwise should be told.

**"Audited"?** If you get one, it covers a fixed scope at a point in time. It
says nothing about the incentive problem above, which is where the actual risk
in this launch sits.

## Bottom line

The contract will work. The vault will not compound unless you personally pay
for it, your gas will eat a third or more of the yield, and small depositors
will lose more to transaction costs than they earn. The fix isn't a better
bounty formula — at $8k no bounty can be simultaneously large enough to attract
a caller and small enough to leave yield behind. **Move it to an L2, or accept
that you're the keeper and budget accordingly, and tell depositors the net
number.**
