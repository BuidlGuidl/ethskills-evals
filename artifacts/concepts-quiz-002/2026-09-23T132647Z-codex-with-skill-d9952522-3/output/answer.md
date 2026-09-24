# First-month operational read

With about $8,000 deposited and a 4% APY strategy, the vault earns roughly:

- Gross annual yield: about `$320`
- Gross first-month yield: about `$26`
- Gross daily yield: about `$0.88`

The 1% `harvest()` caller fee is 1% of the rewards claimed by that call, not 1% of TVL. So if someone harvested the whole first month of rewards in one transaction, the caller would keep only about `$0.26`. If they harvested daily, the caller would earn less than one cent per call.

That is the important operational fact: `harvest()` is permissionless, but it is not economically self-running at this size on Ethereum mainnet. A contract does nothing between transactions. Someone must send `harvest()`, pay gas, and have a reason to do it. At $8,000 TVL, the reason is not there for an outside caller.

Using recent mainnet conditions as a rough reference, ETH around `$2,750` and gas around `0.4-1.2 gwei` means a `250,000` gas harvest costs about `$0.28-$0.83`; a `400,000` gas harvest costs about `$0.44-$1.32`. If gas is `10 gwei`, the same `250,000` gas call costs about `$6.88`. The first-month harvest bounty is only about `$0.26`, so even under unusually cheap gas a rational keeper is likely losing money.

For a caller to break even on a 1% bounty, the harvest needs to claim rewards worth roughly `100x` the gas cost. At a `$0.80` gas cost, that means about `$80` of claimable rewards. This vault earns about `$320` per year at the expected first-month size, so the first break-even harvest might be several months away in low gas conditions, and much longer if gas rises.

## What actually happens after launch

Deposits can still go in, shares can still be issued, and the strategy can still earn. The weak point is compounding.

Unless the team or a subsidized keeper calls `harvest()`, rewards will sit unclaimed instead of being compounded back into the vault. Bots may watch the contract, but they are unlikely to call while the 1% bounty is smaller than their gas cost. The fact that the function is permissionless helps only once the incentive is positive.

If no one calls `harvest()` during the first month, the vault will probably look quiet rather than broken: principal remains deployed, but the advertised compounding path does not occur. Depending on accounting, users may see little or no share-price growth until harvest happens. If pending rewards are not included in withdrawal accounting, early withdrawers may miss rewards that later get harvested for remaining depositors. If pending rewards are included, the implementation needs to be very careful that users cannot exploit stale or manipulable accounting around harvest timing.

If someone does call `harvest()` at month end, depositors receive almost the same economic result as if it had happened more often. At this scale, frequent compounding barely matters. The monthly gross yield is only about `$26`, and the extra return from compounding that yield a few weeks earlier is just a few cents. The 1% bounty itself costs depositors about `$0.26` for the month, reducing a 4% APY strategy to about 3.96% before gas subsidies or any other fees.

## What this means for depositors

Depositors should not expect visible, continuous compounding in month one unless the team operates it. The vault may be technically permissionless but operationally team-maintained at launch.

The depositor impact is small in dollars but large in expectation-setting. On `$8,000` of TVL, the whole vault earns only about `$26` in the first month. If harvest is delayed, the missed compounding benefit is negligible. The bigger issue is whether users understand that yield may appear in jumps, and whether withdrawals before harvest receive a fair share of accrued-but-unclaimed rewards.

The main depositor risks to check before launch are:

- Does `totalAssets()` include pending rewards, or only already-harvested assets?
- If a user deposits right before harvest, can they receive rewards earned before they arrived?
- If a user withdraws right before harvest, do they forfeit rewards earned while they were in the vault?
- Can a caller time `harvest()` around deposits or withdrawals to shift value between users?
- Is there a clear fallback if nobody calls `harvest()` for weeks?

Those are accounting and operations questions more than APY questions. At this TVL, the difference between 4.00% and 3.96% APY is not what will make or break trust. Surprise around when yield appears might.

## What should change before launch

I would change the operating plan before launch. I would not rely on the 1% permissionless bounty as the only harvest mechanism for an $8,000 mainnet vault.

The cleanest launch posture is:

- Keep `harvest()` permissionless.
- Publicly say harvests are opportunistic and may be infrequent while TVL is small.
- Have the team run `harvest()` on a simple threshold, not a clock.
- Use a threshold like: harvest only when claimable rewards are large enough that the caller fee plus compounding benefit justify gas, or when the team is deliberately subsidizing the call for user experience.
- Make sure deposits and withdrawals are fair around unharvested rewards.

If the product promise needs smooth visible yield, then one of these should change:

- Deploy first on a cheaper chain instead of Ethereum mainnet.
- Increase the harvest bounty while TVL is small, possibly with a cap so it cannot become excessive later.
- Add a temporary team-funded keeper budget for the first month.
- Delay launch until expected TVL is high enough that permissionless harvests are actually profitable.
- Use a strategy/accounting model where yield accrues without requiring frequent harvests.

My recommendation: for next week's launch, either move the first deployment off mainnet or explicitly commit to team-operated harvests until TVL is materially higher. The current design is fine as a permissionless fallback, but at `$8,000` of deposits it should not be treated as autonomous infrastructure. Nothing runs itself; the first month only works smoothly if someone is paid enough to push the button, or if the team accepts that it is paying to push it.

Sources for gas/price assumptions checked on September 23, 2026:

- ChainGate Ethereum Gas Tracker: https://chaingate.dev/gas-tracker/ethereum
- Etherscan Gas Tracker: https://etherscan.io/gastracker
- YCharts Ethereum Average Gas Price: https://ycharts.com/indicators/ethereum_average_gas_price/chart/
- MetaMask ETH price: https://metamask.io/en-GB/price/ethereum
