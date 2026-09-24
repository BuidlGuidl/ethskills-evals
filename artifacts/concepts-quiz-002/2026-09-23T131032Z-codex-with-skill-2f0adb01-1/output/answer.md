# Operational read: first month of the USDC vault

The important thing to internalize is that `harvest()` will not run by itself.
The vault is a state machine: deposits can sit in the strategy, rewards can
accrue, and nothing compounds until some address sends a transaction and pays
Ethereum mainnet gas.

## First-month economics

At the expected size, the gross yield is tiny in absolute dollars:

- Expected first-month TVL: about $8,000 USDC
- Strategy APY: about 4%
- Gross annual yield: about $320
- Gross 30-day yield: about $26
- Harvester reward on a full-month harvest: 1% of $26, or about $0.26
- Depositors' remaining first-month gross yield if harvested once: about $25.75

So the permissionless harvester is not being offered "1% of the vault" or even
1% APY. They are being offered 1% of the small amount claimed by that specific
call. In month one, that is cents.

As of September 23, 2026, Ethereum mainnet gas is unusually cheap by historical
standards: Etherscan's gas tracker showed sub-gwei gas and example actions under
a dollar, while ETH was around $2,700. Even in that environment, a monthly
harvest bounty of about $0.26 is marginal. It may cover a very simple call, but
it is not enough to make outside keepers reliably care, especially if `harvest()`
does multiple contract calls, token transfers, swaps, approvals, or accounting
updates. If gas rises, the transaction becomes clearly uneconomic.

The break-even rule is simple:

`caller reward = claimable rewards * 1%`

So a caller needs roughly 100x their gas cost in accrued rewards just to break
even before any profit margin. If the transaction costs $1, the vault needs
about $100 of accrued rewards. At $8,000 TVL and 4% APY, that takes almost four
months. If the transaction costs $5, it takes about 1.5 years.

## What actually happens after launch

Users deposit USDC. The vault puts that USDC into the strategy. The strategy
earns roughly 4% APY, but compounding only happens when `harvest()` is called.

In practice, one of three things happens:

1. No one harvests for a while because the bounty is too small.
   The strategy may still have claimable rewards, but the vault does not
   compound them. Depositors get less frequent compounding and may not see the
   full economic value reflected until someone harvests.

2. The team harvests manually or runs a keeper.
   Then the system is operationally fine, but it is not really self-operating.
   It depends on the team continuing to pay attention.

3. A third party harvests only when enough rewards have built up.
   This is the intended permissionless design, but with $8,000 of TVL it likely
   means infrequent harvests. Daily or weekly harvests are not economically
   rational at this size.

For depositors, the headline 4% APY is already small: about $26 of gross yield
across the whole vault in the first month. The 1% harvest fee is not the main
drag. The bigger issue is operational reliability and accounting fairness.

## Depositor impact

If unharvested rewards are included correctly in `totalAssets`, then delayed
harvesting is mostly a UX and compounding issue. Depositors still economically
own the accrued value, but it may not be compounded frequently.

If unharvested rewards are not included in `totalAssets`, the vault can become
unfair. A user who deposits right before a harvest could receive shares priced
without the pending rewards, then benefit from rewards earned before they
arrived. Existing depositors get diluted. The inverse can also happen on
withdrawal if a user exits before pending rewards are reflected.

Before launch, confirm one of these is true:

- `totalAssets` includes claimable-but-unharvested rewards, net of expected
  harvest fees; or
- the vault harvests before deposits/withdrawals that would otherwise misprice
  shares; or
- the design intentionally excludes pending rewards and clearly accepts the
  dilution/UX tradeoff.

The first option is usually the cleanest if the strategy can value pending
rewards safely.

## What should change before launch

I would not launch this as "permissionless harvesting will keep it compounded"
on Ethereum mainnet at $8,000 expected TVL. The incentive is too small to be
reliable.

Recommended changes:

- Add a minimum profitable harvest threshold so calls do not waste gas or leak
  depositor yield through uneconomic harvests.
- Run your own keeper for the first month, or use a keeper network, and be
  honest that the team is operating this part at small scale.
- Consider a flat keeper subsidy funded by the protocol/team, not by taking a
  larger percentage of depositor yield. Raising the harvester cut enough to
  matter at $8,000 TVL would eat too much of the vault's return.
- Consider launching on an L2 if frequent compounding is part of the product
  promise. Mainnet can work for custody and prestige, but it is a poor fit for
  tiny recurring maintenance transactions.
- Make the UI/APY copy conservative: "strategy earns about 4% APY before vault
  operation effects; harvesting frequency depends on economics." Do not imply
  continuous compounding.
- Audit the share accounting around pending rewards before deposits and
  withdrawals. This is more important than the exact keeper fee.

Bottom line: the vault can safely hold and earn if the contracts are otherwise
sound, but the current harvest incentive is not enough to make the vault
self-operating at the expected first-month size. For launch, either operate the
harvest path yourselves, subsidize it, move the small vault to a cheaper network,
or accept very infrequent compounding and disclose that plainly.

Sources consulted for current network context:

- Etherscan Ethereum Gas Tracker: https://etherscan.io/gastracker/
- Ethereum.org gas overview: https://ethereum.org/developers/docs/gas/
- ETH/USD spot context from Investing.com: https://www.investing.com/crypto/ethereum/eth-usd-historical-data
