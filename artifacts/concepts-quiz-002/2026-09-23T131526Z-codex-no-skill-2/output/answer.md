# Operational read for the first month

At the expected launch size, this vault is too small for permissionless
Ethereum mainnet harvesting to work as an economic system.

With $8,000 deposited and a 4% APY strategy, the vault earns about $320 per
year, about $26.70 per 30-day month, or about $0.88 per day before any harvest
incentive. If deposits ramp through the month instead of arriving on day one,
the first-month gross yield is closer to half that, around $13.

The harvester keeps 1% of the rewards claimed by a harvest call. That means the
public caller earns only:

- about $0.009 after one day of full $8,000 TVL
- about $0.06 after one week
- about $0.27 after a full month

That is nowhere close to an Ethereum mainnet transaction fee for a realistic
strategy harvest. Even using a very low recent gas reference, roughly 1.15 gwei,
and ETH around $2,700, a 200k to 500k gas harvest costs roughly $0.60 to $1.60.
At more normal or spiky gas, the same call can cost several dollars or more.
Ethereum gas is paid as `gas used * gas price`, so the fixed cost of calling
harvest does not scale down just because the vault is small.

## What actually happens once live

The permissionless harvester market probably does nothing. A rational third
party will not spend $1, $3, or $10 in ETH to earn a bounty measured in cents.
Even if nobody harvests for the entire first month, the caller bounty is only
around $0.27 at full TVL. To break even on a $1 harvest, the vault needs about
$100 of accrued rewards, which takes roughly 114 days at $8,000 TVL and 4% APY.
If the harvest costs $5, break-even takes well over a year.

So the vault will sit with rewards unharvested unless the team, a keeper, or a
friendly user subsidizes the transaction. The "permissionless" part remains
technically true, but operationally irrelevant at this size.

## What that means for depositors

Depositors should not expect smooth visible compounding in the first month.
The advertised 4% APY produces only about $26 of total monthly gross yield at
the target TVL, and that yield will not be compounded unless someone pays to
harvest it.

The depositor experience depends on the vault accounting:

- If unharvested rewards are not included in share price or withdrawals,
  early withdrawers may leave accrued rewards behind for whoever remains after
  a later harvest.
- If withdrawals or share pricing somehow account for pending rewards, the
  economics are less unfair, but compounding is still delayed.
- If the team harvests frequently and pays gas from vault assets, gas can eat a
  meaningful share of depositor yield. One $1 harvest consumes about 3.75% of
  the entire expected monthly gross yield. Four $1 weekly harvests consume about
  15%. Several-dollar harvests can wipe out most of the first month's yield.

The user-facing risk is expectation mismatch: "4% APY with compounding" sounds
like the vault is steadily doing work, but at this TVL on mainnet the actual
first-month result is likely closer to "small amount of rewards accrue off to
the side until someone chooses to pay gas."

## What should change before launch

Do not launch this configuration while relying on public harvesters. One of the
following should change:

1. Move the first launch to a cheaper chain or L2.
   This is the cleanest fix. At $8,000 TVL, the product is much better matched
   to low transaction costs.

2. Keep mainnet, but make harvesting an explicit team/keeper operation.
   Treat harvest gas as a launch/operations subsidy, set a minimum-profit or
   minimum-delay threshold, and tell depositors compounding will be periodic,
   not continuous.

3. Increase TVL before enabling public mainnet harvesting.
   For a monthly harvest to pay a 1% bounty large enough to cover a $1 gas cost,
   the vault needs roughly $30,000 TVL at 4% APY. For a $5 gas cost, it needs
   roughly $150,000. Weekly harvesting needs much more.

4. Revisit the incentive design.
   A 1% bounty is too small for this launch size. Raising the bounty enough to
   attract harvesters would transfer a large share of the small yield away from
   depositors, so this is not as good as lowering execution cost or subsidizing
   operations.

My launch recommendation: either deploy this vault on an L2 first, or launch
mainnet with a team-run keeper and clear harvest thresholds. I would not ship
the current mainnet configuration if the story to depositors depends on
permissionless harvesters showing up in month one.

References checked on September 23, 2026:

- Ethereum gas fee mechanics: https://ethereum.org/developers/docs/gas/
- ETH/USD reference price: https://coinmarketcap.com/currencies/ethereum/
- Recent Ethereum average gas reference: https://ycharts.com/indicators/ethereum_average_gas_price
