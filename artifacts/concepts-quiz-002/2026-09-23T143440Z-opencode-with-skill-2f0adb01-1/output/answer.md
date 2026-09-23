# Operational Read: First Month of the USDC Vault

## TL;DR

`harvest()` will almost certainly never be called by anyone but you. The 1%
caller reward is worth less than a dollar while a mainnet transaction costs
several dollars, so the state transition your design depends on has no
economically rational caller. Nothing breaks catastrophically — depositors
still own their yield — but the vault never compounds, the keeper fee is
moot, and you quietly become the operator of a system you designed to run
itself. The launch parameters above should change.

## The math

| Quantity | Value |
|---|---|
| Expected TVL | $8,000 |
| Yield at 4% APY | ~$26.67/month, ~$0.88/day |
| Caller reward (1%) if harvested daily | ~$0.009 |
| Caller reward (1%) if harvested monthly | ~$0.27 |
| Mainnet gas for a harvest call | ~$5–$30 (varies with gas price and strategy complexity) |

For a third-party caller to break even at 1%, a single `harvest()` must claim
**$500–$3,000** in rewards. At $8k TVL and 4% APY, that takes roughly **2 to
11 years** of accumulation. No bot will ever fire this transaction.

## What actually happens once it's live

A smart contract is a state machine: it moves only when someone pokes it and
pays gas, and people only poke when it's worth their while. Applying the
three questions to your one critical state transition (rewards → compounded):

1. **Who pokes it?** In theory, anyone. In practice, no one with a profit
   motive — the reward is two orders of magnitude below the gas cost.
2. **Why would they?** They wouldn't. $0.27 against $5–$30 in gas is a
   guaranteed loss.
3. **Is the incentive sufficient?** No, and it won't become sufficient at any
   harvest cadence available at this TVL.

So the realistic month-one trajectory:

- Rewards accumulate in the strategy, unharvested. The vault sits in State A.
- Eventually you (the team) call `harvest()` yourselves, paying ~$10 in gas
  to claim ~$27, of which you "earn" back $0.27 as the caller fee. You are
  now subsidizing your own protocol — you've built a service, not a
  hyperstructure, and it dies the day you stop paying.
- Alternatively, no one ever calls it, and the compounding step simply never
  occurs.

## What this means for depositors

- **They don't lose their yield** (assuming standard vault accounting where
  share price reflects the strategy's total assets): the ~4% accrues to them
  whether or not `harvest()` runs. The failed incentive is embarrassing, not
  dangerous.
- **They lose the compounding**, which at 4% APY is worth pennies per month —
  economically irrelevant.
- **The real depositor problem is gas, not harvest.** A user depositing
  $1,000 earns ~$3.33/month at 4% APY. A mainnet deposit + eventual withdraw
  round trip can easily cost $10–$20. Small depositors can be net-negative
  for months. At $8k total expected TVL, your users are exactly the ones most
  hurt by mainnet fees.
- If you do harvest as the team at a loss, depositors get compounded yield
  for free — fine for them, but it's you donating money, and it sets an
  expectation you can't scale.

## What should change before launch

Pick one (or more) of these — in rough order of preference for this vault:

1. **Deploy to an L2 (Base, Arbitrum, etc.) instead of mainnet.** Gas drops
   to cents, which fixes *both* problems: deposit/withdraw stops eating
   small depositors' yield, and a harvest reward of even $0.27 becomes
   marginally profitable for keepers. At this TVL, mainnet is the wrong
   venue regardless of the harvest design.
2. **Fold harvest into user interactions.** Call the strategy's
   claim/compound logic inside `deposit()` and `withdraw()`. Then no
   separate incentive is needed at all — the state transition rides on
   transactions that were happening anyway. This is the standard fix for
   "nothing is automatic."
3. **Accrue lazily; delete `harvest()`.** If the strategy's yield is
   reflected in its share price or a `totalAssets()` view, the vault can
   account for it without any claim transaction. No state transition, no
   incentive problem.
4. **If you keep a standalone, incentivized `harvest()`:** size the reward
   to gas, not to the harvest. A fixed reward (or a much larger percentage)
   that exceeds worst-case gas is the only version a stranger will ever
   call. At current TVL on mainnet, no percentage of the harvest clears
   that bar — which is option 1 telling you the venue is wrong.

## Bottom line

The design is sound at scale — this is exactly how Yearn-style keepers work
once harvests are large enough to pay for their own gas. At $8k TVL on
mainnet, the incentive loop is dead on arrival and you become the operator
by default. Move to an L2, or make compounding a side effect of deposits and
withdrawals, and the vault will actually run the way you described it.
