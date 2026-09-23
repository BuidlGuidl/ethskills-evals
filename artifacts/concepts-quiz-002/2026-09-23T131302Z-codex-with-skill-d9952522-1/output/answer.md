# First-month operational read: USDC yield vault on Ethereum mainnet

## Short version

At the expected launch size, `harvest()` probably will not be called by strangers for profit.

With about $8,000 in USDC and a 4% APY strategy, the vault earns about $320/year, or about $26.67/month if the full $8,000 is deposited for the whole month. If deposits ramp up over the month, a more realistic first-month gross yield is closer to half that, around $13.

The caller reward is 1% of what `harvest()` claims. That means the caller reward for an entire first month is only about $0.13-$0.27. A daily harvest would pay the caller less than one cent.

That is the main operational fact: the function is permissionless, but nothing onchain runs itself. Someone still has to send the transaction and pay Ethereum mainnet gas. At this TVL, the 1% bounty is not enough incentive for an independent keeper unless gas is extremely low and the harvest transaction is unusually cheap.

## What happens once it is live

Depositors can put USDC into the vault, and the strategy can earn yield on the USDC it holds. But rewards do not magically move into the vault between transactions. The contract state changes only when someone sends a transaction.

For `harvest()`, the possible callers are:

- A random keeper or searcher, if the 1% caller fee is worth more than gas.
- A depositor, if they want the vault updated badly enough to pay for it.
- The team, if we run a keeper or manually harvest.

The first group is the one the current design appears to rely on. For the first month, that incentive is weak.

Using a spot check on September 23, 2026, Ethereum mainnet "normal" gas was around 0.416 gwei and ETH was around $2,749. A 250,000 gas harvest would cost roughly $0.29 at that gas price. A 500,000 gas harvest would cost roughly $0.57. At the "high" quoted gas level, the same 250,000 gas transaction is about $0.63.

The caller's break-even condition is:

```text
1% of claimed rewards >= gas cost
```

So if the harvest costs $0.29, the call needs to claim at least $29 of rewards before the caller breaks even. If it costs $0.57, it needs to claim at least $57. At $8,000 TVL and 4% APY, the vault earns only about $0.88/day at full utilization.

That means:

- At 250,000 gas and unusually cheap current gas, a permissionless caller might break even only after roughly a full month of rewards have accumulated.
- At 500,000 gas, break-even is more like two months.
- If mainnet gas rises to 5 gwei, a 250,000 gas harvest costs about $3.44, so the caller needs about $344 of claimable rewards. At $8,000 TVL, that is more than a year of yield.

If the strategy's rewards are sitting unclaimed until `harvest()`, then first-month compounding is likely sporadic or absent unless the team operates it. If the strategy's value accrues internally without needing `harvest()`, then the base yield can still accrue, but the explicit claim-and-compound step will still wait for someone to transact.

## What this means for depositors

Depositors should not expect smooth daily compounding in month one. The vault may show a 4% APY strategy, but the actual first-month user experience is more likely to be "small yield accrues, then maybe gets harvested in a batch" than "rewards continuously compound."

The dollar amounts are tiny at launch size:

- Full-month gross yield on $8,000 at 4% APY: about $26.67.
- If deposits ramp linearly to $8,000 during the first month: about $13.33.
- 1% caller fee on those amounts: about $0.13-$0.27.
- Remaining first-month yield for depositors after the caller fee: about $13.20-$26.40 before any other fees, slippage, idle cash, or strategy-specific effects.

The 1% harvest fee itself is not the depositor problem. On $26.67 of yield, it is only $0.27. The problem is that the fee is also too small to get the harvest done reliably on mainnet. Permissionless maintenance only works when the caller's private reward beats the caller's private cost.

If a depositor calls `harvest()` themselves, they may help all vault depositors while personally eating the gas loss. That is not a durable operating model. It creates a public-good problem: everyone benefits from the harvest, but one address pays the transaction cost.

## What should change before launch

I would change the launch plan before shipping this as a mainnet vault that depends on permissionless harvesting.

Best options:

1. Run and fund a team keeper for the first month.

   Treat harvesting as an operating expense until TVL is large enough for the bounty to stand on its own. Make this explicit in depositor-facing docs: early harvesting is team-operated, not economically autonomous.

2. Add a harvest threshold and publish the policy.

   Do not harvest just because a day passed. Harvest only when pending rewards are large enough that compounding is worth the gas. A simple policy is: harvest when the caller bounty is comfortably above estimated gas, or when the team chooses to subsidize the call.

3. Reconsider Ethereum mainnet for an $8,000 launch.

   The strategy yield is about $0.88/day at full first-month TVL. That is not much room for L1 operations. If the vault can launch on an L2 with the same asset and acceptable strategy risk, the maintenance economics become much easier.

4. Do not market this as reliably auto-compounding at launch unless the team is actually operating the keeper.

   "Permissionless harvest" is technically true, but it can imply more liveness than the economics support. A better statement is: anyone can harvest, harvests occur when economically worthwhile, and the team may operate a keeper during the bootstrap period.

5. Consider changing the incentive if autonomous harvesting is required.

   A 1% caller fee is too low for month-one mainnet economics. A higher percentage helps, but at very small TVL it can become a large share of depositor yield and still fail during gas spikes. A flat treasury subsidy, keeper budget, or L2 deployment is cleaner than trying to solve this entirely with a larger percentage fee.

## Recommendation

Do not rely on strangers to call `harvest()` during the first month.

Ship only if one of these is true:

- the team commits to operating and paying for harvests during the bootstrap period;
- the vault moves to a cheaper chain where the 1% bounty is actually meaningful;
- the product is honest that harvests may be infrequent until TVL grows.

For the current mainnet plan, the most practical pre-launch change is to add an explicit keeper policy: team-run harvests at a sensible threshold, with public wording that the vault is permissionless but not self-running. That turns the hidden liveness assumption into an operational commitment depositors can understand.

Sources for the spot assumptions: ChainGate Ethereum gas tracker for September 23, 2026 gas and ETH price (https://chaingate.dev/gas-tracker/ethereum), and ethereum.org's gas documentation for Ethereum's gas cost mechanics (https://ethereum.org/developers/docs/gas/).
